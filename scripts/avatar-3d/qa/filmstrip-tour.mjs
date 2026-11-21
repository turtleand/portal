import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { base, label, evidence, launch, writeReport, sourceHashes, check, S, manifest, openGallery, ready, version, state, threeDResource } from './shared.mjs';

const modelPattern = index => new RegExp(`/turtleand-${manifest[index].version.slice(1).replaceAll('.', '\\.')}[.\\-][^/]*\\.glb(?:\\?|$)`);
const DWELL_MS = 2600;
const FADE_MS = 225;
const report = {
  at: new Date().toISOString(), base, label, sourceHashes: await sourceHashes(),
  scope: 'Production-optimized static client in Chrome. Touch is emulated. Measures real-time model commits and snapshot animation, not physical-device performance.',
  checks: [], screens: [],
};
const browser = await launch('chromium', true);
report.browser = browser.version();
await mkdir(evidence, { recursive: true });

async function runCase(name, options, body) {
  if (process.env.PORTAL_QA_CASES && !new RegExp(process.env.PORTAL_QA_CASES, 'i').test(name)) return;
  const context = await browser.newContext({
    viewport: options.touch ? {width:390, height:844} : {width:1440, height:1000},
    isMobile: Boolean(options.touch), hasTouch: Boolean(options.touch),
    reducedMotion: options.reducedMotion || 'no-preference',
  });
  const page = await context.newPage(), requests = [], errors = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(options.spanish ? `${base}/?lang=es` : base, {waitUntil:'networkidle'});
    await openGallery(page);
    await page.locator(S.mode('3d')).waitFor({state:'visible'});
    await body(page, requests);
    check(report, `${name} has no unhandled page errors`, errors.length === 0, {errors});
  } catch (error) {
    check(report, `${name} completed`, false, {error:error.message, errors, state:await state(page).catch(() => null)});
  } finally {
    await context.close();
  }
}

async function observeHandoff(page) {
  await page.locator(S.root).evaluate((root, selectors) => {
    const trace = {commits:[], durations:[], canonicalFlash:false};
    window.__avatarTourTrace = trace;
    root.addEventListener('avatar-3d:ready', ({detail}) => {
      trace.commits.push({...detail, at:performance.now()});
    });
    function observeFrame() {
      if (trace.commits.length) {
        const snapshot = root.querySelector(selectors.snapshot);
        for (const animation of snapshot?.getAnimations() || []) {
          const {duration} = animation.effect.getTiming();
          if (!trace.durations.includes(duration)) trace.durations.push(duration);
        }
        const canonical = root.querySelector(selectors.stage);
        if (canonical && !canonical.hidden && getComputedStyle(canonical).visibility === 'visible') {
          trace.canonicalFlash = true;
        }
      }
      requestAnimationFrame(observeFrame);
    }
    requestAnimationFrame(observeFrame);
  }, {snapshot:S.snapshot,stage:S.stage});
}

async function capture(page, name) {
  await page.locator(S.panel).evaluate(panel => { panel.scrollTop = 0; });
  await page.screenshot({path:path.join(evidence, name)});
  report.screens.push(name);
}

async function progress(page) {
  return page.locator(S.root).evaluate(root => Number(root.style.getPropertyValue('--evolution-tour-progress')));
}

async function waitForProgress(page, from) {
  await page.waitForFunction(({root, from}) =>
    Number(document.querySelector(root).style.getPropertyValue('--evolution-tour-progress')) > from + .02,
  {root:S.root, from}, {timeout:3500});
}

try {
  await runCase('Desktop guided tour', {}, async (page, requests) => {
    const twoDPlay = page.locator(S.play);
    if ((await page.locator('[data-evolution-play-icon]').textContent()).trim() === 'Ⅱ') await twoDPlay.click();
    const beforeOptIn = [...requests];
    await observeHandoff(page);
    await page.locator(S.mode('3d')).click();
    await ready(page);
    const thumbnailUrls = await page.locator('[data-evolution-3d-select] img').evaluateAll(images => images.map(image => image.currentSrc || image.src));
    check(report, 'Opened 2D makes no viewer, GLB, lighting or thumbnail requests',
      thumbnailUrls.length === manifest.length && !beforeOptIn.some(url => threeDResource(url) || thumbnailUrls.includes(url)),
      {thumbnailUrls, forbidden:beforeOptIn.filter(url => threeDResource(url) || thumbnailUrls.includes(url))});

    if (!requests.some(url => modelPattern(1).test(url))) await page.waitForRequest(modelPattern(1), {timeout:5000});
    const earlyModels = requests.filter(url => /\.glb(?:\?|$)/.test(url));
    check(report, 'Opt-in loads Genesis and warms only the immediately upcoming model',
      earlyModels.length === 2 && modelPattern(0).test(earlyModels[0]) && modelPattern(1).test(earlyModels[1]), {earlyModels});
    check(report, '3D has no separate tour transport button',
      await page.locator('[data-evolution-3d-action="tour"]').count() === 0);
    await capture(page, `${label}-desktop-en-tour.png`);
    await page.waitForFunction(() => window.__avatarTourTrace.commits.length >= 2, null, {timeout:9000});
    await page.locator(S.snapshot).waitFor({state:'detached'});
    const trace = await page.evaluate(() => window.__avatarTourTrace);
    const second = await state(page);
    const firstDwell = trace.commits[1].at - trace.commits[0].at;
    check(report, 'Tour advances automatically near the 2.6-second dwell',
      trace.commits.slice(0, 2).map(commit => commit.id).join(',') === manifest.slice(0, 2).map(stage => stage.id).join(',')
      && firstDwell >= DWELL_MS - 50 && firstDwell < DWELL_MS + 1200 && second.title === manifest[1].title && second.loaded, {firstDwell, trace, second});
    check(report, 'Automatic handoff uses a 225 ms snapshot fade without flashing the canonical SVG',
      trace.durations.includes(FADE_MS) && !trace.canonicalFlash && second.viewers === 1, {trace});

    const before = await page.locator(S.model).evaluate(viewer => viewer.getCameraOrbit().theta);
    const bounds = await page.locator(S.model).boundingBox();
    const x = bounds.x + bounds.width * .5, y = bounds.y + bounds.height * .45;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 90, y, {steps:8});
    await page.waitForFunction(({model, before}) => {
      const viewer = document.querySelector(model);
      return viewer.paused && Math.abs(viewer.getCameraOrbit().theta - before) > .05;
    }, {model:S.model, before}, {timeout:2000});
    const after = await page.locator(S.model).evaluate(viewer => viewer.getCameraOrbit().theta);
    const heldProgress = await progress(page);
    await page.waitForTimeout(3700);
    const held = await state(page);
    check(report, 'Holding a drag past the automatic deadline freezes the current stage and progress',
      Math.abs(after - before) > .05 && held.title === manifest[1].title
      && Math.abs(await progress(page) - heldProgress) < .03
      && await page.locator(S.model).evaluate(viewer => viewer.paused), {before, after, held, heldProgress});
    await page.mouse.up();
    const releasedAt = await page.evaluate(() => performance.now());
    await waitForProgress(page, heldProgress);
    const resumedAfter = await page.evaluate(at => performance.now() - at, releasedAt);
    await page.waitForFunction(() => window.__avatarTourTrace.commits.length >= 3, null, {timeout:6500});
    check(report, 'Releasing the drag resumes the countdown and advances without another action',
      resumedAfter >= 700 && resumedAfter < 2200 && (await state(page)).title === manifest[2].title, {resumedAfter});

    await page.locator(S.snapshot).waitFor({state:'detached'});
    const keyboard = page.locator(S.model).locator('.userInput');
    await keyboard.press('ArrowLeft');
    await page.waitForFunction(model => document.querySelector(model).paused, S.model, {timeout:2000});
    await page.waitForTimeout(550);
    await keyboard.press('ArrowRight');
    const keyboardProgress = await progress(page);
    await page.waitForTimeout(550);
    const heldByKeyboard = Math.abs(await progress(page) - keyboardProgress) < .03 && (await state(page)).title === manifest[2].title;
    await waitForProgress(page, keyboardProgress);
    await page.waitForFunction(() => window.__avatarTourTrace.commits.length >= 4, null, {timeout:6500});
    check(report, 'Successive keyboard adjustments hold the stage and automatically continue after the last key',
      heldByKeyboard && (await state(page)).title === manifest[3].title, {keyboardProgress});
  });

  await runCase('Narrow Spanish manual selection', {spanish:true, touch:true}, async (page, requests) => {
    await observeHandoff(page);
    await page.locator(S.mode('3d')).tap();
    await ready(page);
    await capture(page, `${label}-mobile-es-filmstrip.png`);
    const title = page.locator(S.threeDTitle);
    check(report, 'Spanish stage caption and upcoming thumbnail are visible in the initial narrow modal',
      await page.evaluate(({panel,title,nextThumbnail}) => {
        const bottom = document.querySelector(panel).getBoundingClientRect().bottom;
        return [title,nextThumbnail].every(selector => document.querySelector(selector).getBoundingClientRect().bottom <= bottom);
      }, {panel:S.panel,title:S.threeDTitle,nextThumbnail:S.threeDVersion(1)}) && (await title.textContent()).trim() === manifest[0].titleEs);

    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const delayed = modelPattern(2);
    await page.route(delayed, async route => {
      await gate;
      await route.continue().catch(() => {});
    });
    try {
      const requestStarted = page.waitForRequest(delayed);
      await page.locator(S.threeDVersion(2)).tap();
      await requestStarted;
      const pending = await state(page);
      const selection = await page.locator(S.threeDVersion(0)).getAttribute('aria-current');
      check(report, 'Delayed selection retains previous title, current thumbnail and 3D presentation',
        pending.title === manifest[0].titleEs && selection === 'step' && pending.ready === 'true' && pending.canonical.length === 0
        && await page.locator(S.root).getAttribute('data-model-pending') === '2', {pending, selection});
      await page.locator(S.threeDVersion(4)).tap();
      await ready(page);
      release();
      await page.waitForTimeout(400);
      const latest = await state(page);
      check(report, 'Latest thumbnail wins a rapid selection and obsolete responses cannot replace it',
        latest.title === manifest[4].titleEs && modelPattern(4).test(latest.modelSrc) && latest.viewers === 1
        && await page.locator(S.threeDVersion(4)).getAttribute('aria-current') === 'step', {latest});
      await page.waitForFunction(() => window.__avatarTourTrace.commits.some(commit => commit.index === 5), null, {timeout:6500});
      const trace = await page.evaluate(() => window.__avatarTourTrace);
      const manualDwell = trace.commits.find(commit => commit.index === 5).at - trace.commits.find(commit => commit.index === 4).at;
      check(report, 'The selected chapter receives a fresh dwell and the tour continues to the final chapter',
        manualDwell >= DWELL_MS - 50 && manualDwell < DWELL_MS + 1600
        && !trace.commits.some(commit => commit.index === 2) && (await state(page)).title === manifest[5].titleEs, {manualDwell, trace});
      check(report, 'The resumed tour only warms the successor of the committed selection',
        !requests.some(url => modelPattern(3).test(url)) && requests.some(url => modelPattern(5).test(url)));
    } finally {
      release();
      await page.unroute(delayed);
    }
  });

  await runCase('Reduced motion and recovery', {reducedMotion:'reduce'}, async (page, requests) => {
    await observeHandoff(page);
    await page.locator(S.mode('3d')).click();
    await ready(page);
    await page.waitForTimeout(DWELL_MS + 350);
    const held = await state(page);
    check(report, 'Reduced motion starts paused at Genesis without a speculative next GLB and without continuous rotation',
      held.title === manifest[0].title && !held.rotating && requests.filter(url => /\.glb(?:\?|$)/.test(url)).length === 1
      && await page.locator(S.model).evaluate(viewer => viewer.paused), {held});
    const pattern = modelPattern(2);
    await page.route(pattern, route => route.abort('failed'));
    await page.locator(S.threeDVersion(2)).click();
    await page.locator(S.action('retry')).waitFor({state:'visible'});
    const fallback = await state(page);
    check(report, 'A failed next model falls back to its own canonical with retry available',
      fallback.title === manifest[2].title && fallback.ready !== 'true' && fallback.canonical.some(item => item.index === '2' && item.svg), {fallback});
    await page.unroute(pattern);
    await page.locator(S.action('retry')).click();
    await ready(page);
    await version(page, 1);
    await ready(page);
    await page.waitForTimeout(DWELL_MS + 350);
    const trace = await page.evaluate(() => window.__avatarTourTrace);
    const last = await state(page);
    check(report, 'Retry recovers and reduced-motion stage selections cut without restarting automatic motion',
      trace.commits.some(commit => commit.id === manifest[2].id) && trace.durations.length === 0
      && last.title === manifest[1].title && last.loaded && !last.rotating && await page.locator(S.snapshot).count() === 0
      && await page.locator(S.model).evaluate(viewer => viewer.paused), {trace, last});
  });
} finally {
  await browser.close();
  await writeReport(`${label}-filmstrip-tour.json`, report);
}

if (report.checks.some(item => !item.pass)) process.exitCode = 1;
