import fs from 'node:fs/promises';
import path from 'node:path';
import { base, label, evidence, launch, openGallery, ready, version, state, S, manifest, sourceHashes, check, writeReport } from './shared.mjs';

const report = {
  at: new Date().toISOString(), base, label, sourceHashes: await sourceHashes(),
  scope: 'Production client recovery when canonical SVG fetch and image fallback both fail. Covers ready 3D, return to 2D, failed GLB and explicit retry in English and Spanish.',
  checks: [], errors: [], screens: [],
};
await fs.mkdir(path.dirname(path.join(evidence, `${label}-canonical-failure.json`)), { recursive: true });
const browser = await launch('chromium', true);

async function presentation(page) {
  return page.evaluate(() => {
    const overlay = document.querySelector('[data-evolution-unavailable]');
    const style = getComputedStyle(overlay);
    return {
      unavailableVisible: !overlay.hidden && style.display !== 'none' && style.visibility !== 'hidden',
      canvasLabel: document.querySelector('[data-evolution-canvas]').getAttribute('aria-label'),
    };
  });
}

try {
  for (const lang of ['en', 'es']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage(), errors = [];
      let failModel = false;
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/turtleand-[^/]+\.svg(?:\?.*)?$/, route => route.abort());
      await page.route(/\.glb(?:\?.*)?$/, route => failModel ? route.abort() : route.continue());
      await page.goto(`${base}/${lang === 'es' ? '?lang=es' : ''}`, { waitUntil: 'networkidle' });
      await openGallery(page);
      await page.locator('[data-evolution-unavailable]').waitFor({ state: 'visible' });
      const unavailable = value => /unavailable|no está disponible/.test(value.canvasLabel);
      const initial = await presentation(page);
      check(report, `${lang} missing canonical SVG exposes unavailable 2D state`, initial.unavailableVisible && unavailable(initial), initial);

      await page.locator(S.mode('3d')).click(); await ready(page);
      const loaded = await presentation(page), loadedState = await state(page);
      check(report, `${lang} ready 3D clears unavailable overlay and label`, !loaded.unavailableVisible && !unavailable(loaded) && loaded.canvasLabel.includes(manifest[0][lang === 'es' ? 'titleEs' : 'title']) && loadedState.loaded, { ...loaded, state: loadedState });
      const screenshot = `${label}-${lang}-canonical-failure-3d-ready.png`;
      await page.screenshot({ path: path.join(evidence, screenshot) }); report.screens.push(screenshot);

      await page.locator(S.mode('2d')).click();
      await page.locator('[data-evolution-unavailable]').waitFor({ state: 'visible' });
      const returned = await presentation(page);
      check(report, `${lang} return to 2D restores unavailable overlay and label`, returned.unavailableVisible && unavailable(returned) && (await state(page)).viewers === 0, returned);

      await version(page, 1);
      failModel = true;
      await page.locator(S.mode('3d')).click();
      await page.locator(S.action('retry')).waitFor({ state: 'visible', timeout: 45000 });
      const failed = await presentation(page), failedState = await state(page);
      check(report, `${lang} failed GLB preserves unavailable canonical fallback`, failed.unavailableVisible && unavailable(failed) && failedState.ready !== 'true' && failedState.viewers === 0, { ...failed, state: failedState });

      failModel = false;
      await page.locator(S.action('retry')).click(); await ready(page);
      const recovered = await presentation(page), recoveredState = await state(page);
      check(report, `${lang} successful retry restores visible model and metadata label`, !recovered.unavailableVisible && !unavailable(recovered) && recovered.canvasLabel.includes(manifest[1][lang === 'es' ? 'titleEs' : 'title']) && recoveredState.loaded && recoveredState.viewers === 1, { ...recovered, state: recoveredState });
      check(report, `${lang} canonical and GLB recovery has no unhandled page errors`, errors.length === 0, { errors });
    } finally { await context.close(); }
  }
} catch (error) {
  report.errors.push(error.message);
  check(report, 'Canonical failure regression completed', false, { error: error.message });
} finally {
  await browser.close();
  await writeReport(`${label}-canonical-failure.json`, report);
}
if (report.checks.some(item => !item.pass)) process.exitCode = 1;
