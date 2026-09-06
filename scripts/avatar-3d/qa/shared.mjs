import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const evidence = path.join(repo, 'docs/avatar-3d-implementation/evidence');
export const base = process.env.PORTAL_QA_BASE_URL || 'http://127.0.0.1:4391';
export const label = process.env.PORTAL_QA_LABEL || 'candidate';
export const engines = (process.env.PORTAL_QA_ENGINES || 'chromium,firefox,webkit').split(',');
export const S = {
  trigger: '[data-open-avatar-gallery]', modal: '[data-avatar-modal]', panel: '[data-avatar-modal-panel]',
  root: '[data-avatar-evolution]', stage: '[data-evolution-stage]', meta: '[data-evolution-meta]',
  title: '[data-evolution-title]', description: '[data-evolution-description]',
  close: '[data-avatar-modal-close]', play: '[data-evolution-action="play"]',
  previous: '[data-evolution-action="previous"]', next: '[data-evolution-action="next"]',
  restart: '[data-evolution-action="restart"]', model: '[data-evolution-model-host] model-viewer',
  mode: value => `[data-evolution-mode="${value}"]`, version: index => `[data-evolution-select="${index}"]`,
  action: value => `[data-evolution-3d-action="${value}"]`, status: '[data-evolution-3d-status]',
};
export const manifest = JSON.parse(await fs.readFile(path.join(repo, 'src/data/avatarVersions.json'), 'utf8'));
export const threeDResource = url => /(?:model-viewer|\.glb(?:\?|$)|\.gltf(?:\?|$)|\.hdr(?:\?|$)|\.ktx2(?:\?|$)|\.basis(?:\?|$)|draco|meshopt)/i.test(url);

export async function playwright() { return import(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
export async function launch(name, performance = false) {
  const api = await playwright();
  const options = { headless: true };
  if (name === 'chromium' && (performance || process.env.PORTAL_QA_CHROME === '1')) {
    options.channel = 'chrome';
    options.args = ['--use-angle=metal'];
  }
  return api[name].launch(options);
}
export async function sourceHashes() {
  const sourceRoot=process.env.PORTAL_QA_SOURCE_ROOT || repo;
  const files = ['src/components/avatar/three-d-controller.js', 'src/components/avatar/evolution-controller.js', 'src/components/avatar/AnimatedAvatarGallery.astro', 'src/components/avatar/modal-controller.js', 'src/data/avatar3d.ts', 'package-lock.json', ...manifest.map(stage=>`src/images/avatar/3d/turtleand-${stage.version.replace(/^v/,'')}.glb`), 'src/images/avatar/3d/warm.hdr'];
  return Object.fromEntries(await Promise.all(files.map(async file => {
    try { return [file, createHash('sha256').update(await fs.readFile(path.join(sourceRoot, file))).digest('hex')]; }
    catch { return [file, null]; }
  })));
}
export async function writeReport(name, data) {
  await fs.mkdir(evidence, { recursive: true });
  await fs.writeFile(path.join(evidence, name), `${JSON.stringify(data, null, 2)}\n`);
}
export function check(report, name, pass, details = {}) {
  report.checks.push({ name, pass: Boolean(pass), ...details });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
}
export async function openGallery(page) {
  await page.locator(S.trigger).first().click();
  await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-hidden') === 'false', S.modal);
  await page.waitForFunction(selector => Boolean(document.querySelector(selector)?.textContent?.match(/v0\./)), S.meta);
  // The existing modal deliberately focuses its panel in a zero-delay task.
  // Wait for that focus handoff before issuing keyboard interactions.
  await page.waitForFunction(selector => document.activeElement === document.querySelector(selector), S.panel);
}
export async function ready(page, timeout = 45000) {
  await page.waitForFunction(selector => document.querySelector(selector)?.dataset.modelReady === 'true', S.root, { timeout });
}
export async function version(page, index) {
  await page.locator(S.version(index)).click();
  await page.waitForFunction(({selector, expected}) => document.querySelector(selector)?.textContent.includes(expected), { selector:S.meta, expected:manifest[index].version });
}
export async function state(page) {
  return page.evaluate(S => {
    const root = document.querySelector(S.root), modal = document.querySelector(S.modal), viewer = document.querySelector(S.model);
    const visible = element => { if (!element) return false; const style=getComputedStyle(element), bounds=element.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity)>0 && bounds.width>0 && bounds.height>0; };
    const canonical = [...document.querySelectorAll('[data-evolution-layer]')].filter(visible).map(layer=>({index:layer.dataset.evolutionLayer, svg:visible(layer.querySelector('svg')), pose:layer.querySelector('svg')?.dataset.walkPose}));
    const dimensions=viewer?.loaded?viewer.getDimensions():null;
    return { mode:root?.dataset.representation, ready:root?.dataset.modelReady, open:modal?.getAttribute('aria-hidden')==='false', version:document.querySelector(S.meta)?.textContent, title:document.querySelector(S.title)?.textContent, description:document.querySelector(S.description)?.textContent, lang:document.documentElement.lang, viewers:document.querySelectorAll('model-viewer').length, modelSrc:viewer?.src, loaded:viewer?.loaded, dimensions:dimensions?{x:dimensions.x,y:dimensions.y,z:dimensions.z}:null, rotating:viewer?.hasAttribute('auto-rotate'), status:document.querySelector(S.status)?.textContent, canonical, overflow:document.documentElement.scrollWidth>innerWidth, panelOverflow:document.querySelector(S.panel)?.scrollWidth>document.querySelector(S.panel)?.clientWidth };
  }, Object.fromEntries(Object.entries(S).filter(([,value])=>typeof value==='string')));
}

// Count real WebGL draw calls. This intentionally does not count rAF callbacks.
// Used only in QA browser contexts, never included in production source.
export function installDrawProbe() {
  const contexts = [], draws = [];
  window.__avatarDrawProbe = { contexts, draws };
  for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
    for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const original = Type.prototype[method];
      if (typeof original !== 'function') continue;
      Type.prototype[method] = function(...args) {
        let index=contexts.indexOf(this); if(index<0){index=contexts.push(this)-1;draws[index]=0;}
        draws[index]++;
        return Reflect.apply(original,this,args);
      };
    }
  }
}
