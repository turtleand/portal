import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { base, label, evidence, launch, writeReport, sourceHashes, check, S, manifest, openGallery, ready, version, state, threeDResource } from './shared.mjs';

const modelPattern = index => new RegExp(`/turtleand-${manifest[index].version.slice(1).replaceAll('.', '\\.')}[.\\-][^/]*\\.glb(?:\\?|$)`);
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
    await capture(page, `${label}-desktop-en-tour.png`);
    await page.waitForFunction(() => window.__avatarTourTrace.commits.length >= 2, null, {timeout:9000});
    await page.locator(S.snapshot).waitFor({state:'detached'});
    const trace = await page.evaluate(() => window.__avatarTourTrace);
    const second = await state(page);
    const firstDwell = trace.commits[1].at - trace.commits[0].at;
    check(report, 'Tour advances autonomously from Genesis to Quantum near the 3.5-second dwell',
      trace.commits.slice(0, 2).map(commit => commit.id).join(',') === manifest.slice(0, 2).map(stage => stage.id).join(',')
      && firstDwell >= 3300 && firstDwell < 5000 && second.title === manifest[1].title && second.loaded, {firstDwell, trace, second});
    check(report, 'Automatic handoff uses a 300 ms snapshot fade without flashing the canonical SVG',
      trace.durations.includes(300) && !trace.canonicalFlash && second.viewers === 1, {trace});

    const before = await page.locator(S.model).evaluate(viewer => viewer.getCameraOrbit().theta);
    const bounds = await page.locator(S.model).boundingBox();
    const x = bounds.x + bounds.width * .5, y = bounds.y + bounds.height * .45;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 90, y, {steps:8});
    await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await page.locator(S.model).evaluate(viewer => viewer.getCameraOrbit().theta);
    await page.waitForTimeout(3650);
    const held = await state(page);
    check(report, 'Pointer orbit changes camera and holds the current model past the next automatic step',
      Math.abs(after - before) > .05 && held.title === manifest[1].title
      && await page.locator(S.model).evaluate(viewer => viewer.paused), {before, after, held});
  });

  await runCase('Narrow Spanish manual selection', {spanish:true, touch:true}, async (page, requests) => {
    await page.locator(S.mode('3d')).tap();
    await ready(page);
    await page.locator(S.tour).tap();
    await capture(page, `${label}-mobile-es-filmstrip.png`);
    const title = page.locator(S.threeDTitle);
    check(report, 'Spanish stage caption and tour control are visible in the initial narrow modal',
      await page.evaluate(({panel,title,tour}) => {
        const bottom = document.querySelector(panel).getBoundingClientRect().bottom;
        return [title,tour].every(selector => document.querySelector(selector).getBoundingClientRect().bottom <= bottom);
      }, {panel:S.panel,title:S.threeDTitle,tour:S.tour}) && (await title.textContent()).trim() === manifest[0].titleEs);

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
      await version(page, 4);
      await ready(page);
      release();
      await page.waitForTimeout(3650);
      const latest = await state(page);
      check(report, 'Latest thumbnail wins a rapid selection and stops tour progression',
        latest.title === manifest[4].titleEs && modelPattern(4).test(latest.modelSrc) && latest.viewers === 1
        && await page.locator(S.threeDVersion(4)).getAttribute('aria-current') === 'step'
        && await page.locator(S.model).evaluate(viewer => viewer.paused), {latest});
      check(report, 'Paused and manually selected stages do not initiate additional speculative GLBs',
        !requests.some(url => modelPattern(3).test(url) || modelPattern(5).test(url)));
    } finally {
      release();
      await page.unroute(delayed);
    }
  });

  await runCase('Reduced motion and recovery', {reducedMotion:'reduce'}, async (page, requests) => {
    await observeHandoff(page);
    await page.locator(S.mode('3d')).click();
    await ready(page);
    await page.waitForTimeout(3650);
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
    const trace = await page.evaluate(() => window.__avatarTourTrace);
    const last = await state(page);
    check(report, 'Retry recovers and reduced-motion stage selections cut without a fade',
      trace.commits.some(commit => commit.id === manifest[2].id) && trace.durations.length === 0
      && last.title === manifest[1].title && last.loaded && !last.rotating && await page.locator(S.snapshot).count() === 0, {trace, last});

    await page.locator(S.tour).click();
    await page.waitForFunction(({selector,title}) => document.querySelector(selector)?.textContent === title,
      {selector:S.threeDTitle,title:manifest[2].title}, {timeout:8000});
    const explicitPlay = await page.evaluate(() => window.__avatarTourTrace);
    check(report, 'Explicit Play under reduced motion advances without a fade or animated character',
      explicitPlay.durations.length === 0 && await page.locator(S.snapshot).count() === 0
      && await page.locator(S.model).evaluate(viewer => viewer.paused), {explicitPlay});
    await page.locator(S.tour).click();
  });
} finally {
  await browser.close();
  await writeReport(`${label}-filmstrip-tour.json`, report);
}

if (report.checks.some(item => !item.pass)) process.exitCode = 1;
