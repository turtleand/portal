import {base, label, playwright, writeReport, sourceHashes, check, S, manifest, openGallery, ready, version, threeDResource} from './shared.mjs';

const api = await playwright();
const browser = await api.chromium.launch({
  headless: true,
  ...(process.env.PORTAL_QA_CHROMIUM ? {executablePath: process.env.PORTAL_QA_CHROMIUM} : {}),
  args: ['--no-sandbox', ...(process.env.PORTAL_QA_SOFTWARE_GL === '1' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])],
});
const report = {
  at: new Date().toISOString(), base, label, browser: browser.version(),
  rendering: process.env.PORTAL_QA_SOFTWARE_GL === '1' ? 'SwiftShader software WebGL' : 'Default browser WebGL',
  sourceHashes: await sourceHashes(),
  scope: 'Production client build, cold contexts, controlled dependency/network races and real embedded animation time. No physical-device or GPU timing claim.',
  checks: [], cases: [],
};

async function runCase(name, body, reducedMotion = 'reduce') {
  if (process.env.PORTAL_QA_CASES && !new RegExp(process.env.PORTAL_QA_CASES, 'i').test(name)) return;
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion});
  await context.addInitScript(() => {
    const originalFetch = window.fetch;
    window.__avatarModelTransfers = [];
    window.fetch = function(input, options) {
      const source = String(input);
      if (/\.glb(?:\?|$)/.test(source)) {
        const transfer = {source, started: performance.now(), aborted: false};
        window.__avatarModelTransfers.push(transfer);
        options?.signal?.addEventListener('abort', () => {transfer.aborted = true;}, {once: true});
      }
      return originalFetch.call(this, input, options);
    };
  });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {if (!request.url().startsWith('blob:')) requests.push(request.url());});
  try {
    await page.goto(base, {waitUntil: 'networkidle'});
    await openGallery(page);
    await page.waitForFunction(() => document.querySelectorAll('[data-evolution-svg]').length === 6);
    check(report, `${name}: no 3D download before opt-in`, !requests.some(threeDResource));
    await body(page, requests);
    check(report, `${name}: no unhandled page errors`, errors.length === 0, {errors});
  } catch (error) {
    check(report, `${name}: scenario completed`, false, {error: error.message, errors});
  } finally {
    report.cases.push({name, errors});
    await context.close();
    await writeReport(`${label}-loading-animation.json`, report);
  }
}

try {
  await runCase('Parallel cold startup', async (page, requests) => {
    let releaseRuntime;
    const runtimeGate = new Promise(resolve => {releaseRuntime = resolve;});
    await page.route(/model-viewer.*\.js(?:\?|$)/, async route => {
      await runtimeGate;
      await route.continue().catch(() => {});
    });
    const selectedTransfer = page.waitForRequest(/\.glb(?:\?|$)/, {timeout: 5000});
    await page.locator(S.mode('3d')).click();
    await selectedTransfer;
    check(report, 'Selected GLB starts while runtime remains unavailable', await page.evaluate(() => !customElements.get('model-viewer')));
    check(report, 'Cold startup requests only the selected GLB', requests.filter(url => /\.glb(?:\?|$)/.test(url)).length === 1);
    check(report, 'Canonical stage covers the delayed runtime', await page.locator(S.root).getAttribute('data-model-ready') !== 'true');
    releaseRuntime();
    await ready(page);
    check(report, 'Opted-in hidden loading host uses eager delivery', await page.locator(S.model).getAttribute('loading') === 'eager');
    check(report, 'Renderer does not redownload the selected GLB', requests.filter(url => /\.glb(?:\?|$)/.test(url)).length === 1);
  });

  await runCase('Navigation cancels stale transfer', async page => {
    let release;
    const gate = new Promise(resolve => {release = resolve;});
    let first = true;
    await page.route('**/*.glb*', async route => {
      if (first) {first = false; await gate;}
      await route.continue().catch(() => {});
    });
    const started = page.waitForRequest(/\.glb(?:\?|$)/);
    await page.locator(S.mode('3d')).click();
    await started;
    await version(page, 5);
    await ready(page);
    check(report, 'Navigation aborts the obsolete model download', await page.evaluate(() => window.__avatarModelTransfers[0].aborted));
    check(report, 'Newest selected version renders without waiting for the stale response', await page.locator(S.model).evaluate(element => element.dataset.modelSource.includes('turtleand-0.1.1.')));
    release();
    await page.waitForTimeout(250);
    check(report, 'Stale completion cannot replace the ready selected model', (await page.locator(S.meta).textContent()).includes(manifest[5].version) && await page.locator(S.model).count() === 1);
  });

  await runCase('Close cancels pending transfer', async page => {
    let release;
    const gate = new Promise(resolve => {release = resolve;});
    await page.route('**/*.glb*', async route => {await gate; await route.continue().catch(() => {});});
    const started = page.waitForRequest(/\.glb(?:\?|$)/);
    await page.locator(S.mode('3d')).click();
    await started;
    await page.locator(S.close).click();
    check(report, 'Close aborts the in-flight GLB fetch', await page.evaluate(() => window.__avatarModelTransfers[0].aborted));
    release();
    await page.unroute('**/*.glb*');
    await page.waitForTimeout(300);
    check(report, 'Late dependency completion leaves no viewer in the closed gallery', await page.locator(S.model).count() === 0);
    await openGallery(page);
    await page.locator(S.mode('3d')).click();
    await ready(page);
    check(report, 'Reopen recovers from interrupted model loading', await page.locator(S.root).getAttribute('data-model-ready') === 'true');
  });

  await runCase('Embedded animation playback', async page => {
    await page.locator(S.mode('3d')).click();
    await ready(page);
    const pose = () => page.locator(S.model).evaluate(element => ({paused: element.paused, time: element.currentTime, name: element.animationName, animations: element.availableAnimations}));
    await page.waitForFunction(selector => document.querySelector(selector).currentTime > .1, S.model);
    const started = await pose();
    check(report, 'Ready 3D character plays its Idle clip', !started.paused && started.name === 'Idle' && started.animations.includes('Idle'), {pose: started});
    await page.locator(S.play).click();
    await page.waitForTimeout(100);
    const paused = await pose();
    await page.waitForTimeout(400);
    const settled = await pose();
    check(report, 'Main pause freezes character animation and rotation', paused.paused && settled.time === paused.time && await page.locator(S.model).getAttribute('auto-rotate') === null, {paused, settled});
    await page.locator(S.play).click();
    await page.waitForFunction(({selector, time}) => !document.querySelector(selector).paused && document.querySelector(selector).currentTime !== time, {selector: S.model, time: settled.time});
    check(report, 'Main play resumes embedded animation from the held pose', !(await pose()).paused);
    await page.locator(S.action('left')).click();
    check(report, 'Manual camera inspection pauses the character', (await pose()).paused);
    await page.locator(S.play).click();
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.waitForFunction(selector => {
      const viewer = document.querySelector(selector);
      return matchMedia('(prefers-reduced-motion: reduce)').matches && viewer.paused && !viewer.hasAttribute('auto-rotate');
    }, S.model);
    const reduced = await pose();
    await page.waitForTimeout(400);
    const held = await pose();
    const rotation = await page.locator(S.model).getAttribute('auto-rotate');
    check(report, 'Reduced motion freezes embedded animation and rotation', reduced.paused && held.time === reduced.time && rotation === null, {reduced, held, rotation});
  }, 'no-preference');

  await runCase('Lineage animation coverage with reduced motion', async page => {
    await page.locator(S.mode('3d')).click();
    await ready(page);
    for (let index = 0; index < manifest.length; index++) {
      if (index) {await version(page, index); await ready(page);}
      const pose = await page.locator(S.model).evaluate(element => ({name: element.animationName, animations: element.availableAnimations, paused: element.paused, time: element.currentTime}));
      check(report, `${manifest[index].version} loads Idle and holds the resting pose`, pose.name === 'Idle' && pose.animations.includes('Idle') && pose.paused && pose.time === 0, {pose});
    }
  });
} finally {
  await browser.close();
  await writeReport(`${label}-loading-animation.json`, report);
}
if (report.checks.some(item => !item.pass)) process.exitCode = 1;
