import viewerRuntimeUrl from '@google/model-viewer/dist/model-viewer.min.js?url';

const OPENING_ORBIT = '-28deg 78deg 100%';
const DWELL_MS = 6500;
const DEPENDENCY_TIMEOUT_MS = 30000;
let runtimeImport;
let runtimeAttempt = 0;
let graphicsVerified = false;
let studioEnvironment;

function loadViewerRuntime() {
  if (customElements.get('model-viewer')) return Promise.resolve();
  if (runtimeImport) return runtimeImport;
  let timeout;
  // Native imports cannot be aborted. A fresh retry may register the component
  // before an older request finishes, so a late duplicate registration is settled.
  const imported = import(/* @vite-ignore */ `${viewerRuntimeUrl}${runtimeAttempt ? `?retry=${runtimeAttempt}` : ''}`)
    .catch(error => {
      if (!customElements.get('model-viewer')) throw error;
    });
  const request = Promise.race([
    imported,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('3D runtime unavailable')), DEPENDENCY_TIMEOUT_MS);
    }),
  ])
    .catch(error => {
      if (runtimeImport === request) { runtimeImport = undefined; runtimeAttempt++; }
      throw error;
    })
    .finally(() => clearTimeout(timeout));
  runtimeImport = request;
  return request;
}

function verifyGraphics() {
  if (graphicsVerified) return;
  const context = document.createElement('canvas').getContext('webgl2');
  if (!context) throw new Error('3D graphics unavailable');
  context.getExtension('WEBGL_lose_context')?.loseContext();
  graphicsVerified = true;
}

function loadStudioEnvironment(source) {
  if (studioEnvironment) return studioEnvironment;
  // Keep one validated, self-contained studio map. Owning its download avoids
  // rejected HDR promises persisting in the renderer's environment cache.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEPENDENCY_TIMEOUT_MS);
  const request = fetch(source, {credentials: 'same-origin', signal: controller.signal})
    .then(async response => {
      if (!response.ok) throw new Error('Studio lighting unavailable');
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const header = new TextDecoder().decode(bytes.subarray(0, 160))
        .match(/^#\?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y (\d+) \+X (\d+)\n/);
      // The reproducible studio exporter writes flat RGBE pixels, four bytes each.
      if (!header || buffer.byteLength !== header[0].length + Number(header[1]) * Number(header[2]) * 4) {
        throw new Error('Studio lighting is invalid');
      }
      return `${URL.createObjectURL(new Blob([buffer], {type: 'application/octet-stream'}))}#studio.hdr`;
    })
    .catch(error => {
      if (studioEnvironment === request) studioEnvironment = undefined;
      throw error;
    })
    .finally(() => clearTimeout(timeout));
  studioEnvironment = request;
  return request;
}

/** Optional 3D presentation. The evolution controller retains version and modal ownership. */
export class AvatarThreeDController {
  constructor(owner, assets, environmentUrl) {
    this.owner = owner;
    this.assets = assets;
    this.environmentUrl = environmentUrl;
    this.root = owner.root;
    this.host = this.root.querySelector('[data-evolution-model-host]');
    this.tools = this.root.querySelector('[data-evolution-3d-tools]');
    this.status = this.root.querySelector('[data-evolution-3d-status]');
    this.buttons = [...this.root.querySelectorAll('[data-evolution-3d-action]')];
    this.mode = '2d';
    this.viewer = null;
    this.idleViewer = null;
    this.idleReady = Promise.resolve();
    this.generation = 0;
    this.ready = false;
    this.failed = false;
    this.playing = false;
    this.rotating = false;
    this.visible = false;
    this.attempts = new Map();
    this.message = '';
    this.root.querySelectorAll('[data-evolution-mode]').forEach(button => {
      button.addEventListener('click', () => this.setMode(button.dataset.evolutionMode));
    });
    this.buttons.forEach(button => button.addEventListener('click', () => {
      const action = button.getAttribute('data-evolution-3d-action');
      if (action === 'retry') void this.load();
      if (action === 'rotation') { this.rotating = !this.rotating; this.update(); }
      if (action === 'left' || action === 'right') this.turn(action === 'left' ? -25 : 25);
      if (action === 'reset') this.resetView();
    }));
    new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      if (!this.visible) this.pauseDwell();
      this.update();
      if (this.visible) this.scheduleDwell();
    }, {threshold: .05}).observe(owner.canvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
        if (this.active) this.dispose();
      } else if (this.active && !this.viewer) {
        void this.load();
      }
      this.update();
    });
    owner.reducedMotionQuery.addEventListener('change', () => {
      if (owner.reducedMotionQuery.matches) this.pause();
      this.viewer?.setAttribute('interpolation-decay', owner.reducedMotionQuery.matches ? '0' : '65');
      this.update();
    });
    this.update();
  }

  get active() { return this.mode === '3d' && this.owner.active; }
  get stage() { return this.owner.stages[this.owner.index]; }
  t(key) { return this.owner.translate(`avatar.threeD.${key}`); }

  setMode(next) {
    if (!['2d', '3d'].includes(next) || next === this.mode || !this.owner.active || this.owner.loading) return;
    const resume = this.mode === '2d' ? this.owner.isPlaybackRunning() : this.playing;
    this.owner.clearHold();
    this.owner.cancelMotion();
    this.owner.visitId++;
    this.owner.visitWalkState = 'idle';
    this.owner.autoplay = false;
    this.owner.resumeAutoplay = false;
    this.owner.paused = false;
    this.mode = next;
    this.owner.showStableStage(this.owner.index);
    if (next === '3d') {
      this.playing = resume && !this.owner.reducedMotionQuery.matches;
      this.rotating = this.playing;
      void this.load();
    } else {
      this.dispose();
      this.playing = this.rotating = false;
      if (resume && !this.owner.reducedMotionQuery.matches) this.owner.startAutoplay();
    }
    this.update();
  }

  select(index, continuePlaying = false) {
    this.clearDwell();
    this.playing = continuePlaying && !this.owner.reducedMotionQuery.matches;
    if (!continuePlaying) this.rotating = false;
    if (index === this.owner.index && this.ready) {
      this.resetView();
      this.update();
      this.scheduleDwell();
      return;
    }
    this.owner.showStableStage(index);
    this.owner.render(true);
    void this.load();
  }

  togglePlayback() {
    if (this.owner.reducedMotionQuery.matches) return;
    if (this.playing || this.rotating) return this.pause();
    this.playing = this.rotating = true;
    if (this.owner.index === this.owner.stages.length - 1) this.select(0, true);
    else this.scheduleDwell();
    this.update();
  }

  pause() {
    this.playing = this.rotating = false;
    this.pauseDwell();
    this.update();
  }

  restart() {
    this.rotating = !this.owner.reducedMotionQuery.matches;
    this.select(0, !this.owner.reducedMotionQuery.matches);
  }

  clearDwell() {
    clearTimeout(this.dwellTimer);
    this.dwellTimer = 0;
    this.dwellRemaining = 0;
  }

  pauseDwell() {
    if (this.dwellTimer) this.dwellRemaining = Math.max(1, this.dwellDeadline - performance.now());
    clearTimeout(this.dwellTimer);
    this.dwellTimer = 0;
  }

  scheduleDwell() {
    if (!this.active || !this.playing || !this.visible || document.hidden || this.owner.reducedMotionQuery.matches || (!this.ready && !this.failed) || this.dwellTimer) return;
    if (this.owner.index === this.owner.stages.length - 1) {
      this.pause();
      return;
    }
    const duration = this.dwellRemaining || DWELL_MS;
    this.dwellDeadline = performance.now() + duration;
    this.dwellTimer = setTimeout(() => {
      this.dwellTimer = 0;
      if (this.active && this.playing) this.select(this.owner.index + 1, true);
    }, duration);
  }

  invalidate() {
    if (this.pendingAssetId) {
      // A cancelled in-flight loader promise can remain cached after disconnect.
      // Only interrupted assets get a fresh URL; completed models stay reusable.
      this.attempts.set(this.pendingAssetId, (this.attempts.get(this.pendingAssetId) || 0) + 1);
      this.pendingAssetId = null;
    }
    ++this.generation;
    this.events?.abort();
    this.events = null;
    clearTimeout(this.slowTimer);
    clearTimeout(this.failureTimer);
    cancelAnimationFrame(this.frame);
    this.clearDwell();
    this.ready = this.failed = false;
    this.viewer?.removeAttribute('auto-rotate');
    this.viewer?.setAttribute('aria-hidden', 'true');
    this.viewer?.setAttribute('tabindex', '-1');
    this.root.dataset.modelReady = 'false';
    this.host.setAttribute('aria-hidden', 'true');
  }

  dispose() {
    this.invalidate();
    if (this.viewer) {
      const retired = this.viewer;
      this.viewer = null;
      retired.src = null;
      retired.removeAttribute('src');
      retired.removeAttribute('environment-image');
      retired.remove();
      // Reuse one empty component shell. Disconnect releases its scene; repeatedly
      // creating this component retained internal listener allocations in v4.3.1.
      this.idleViewer = retired;
      customElements.get('model-viewer').modelCacheSize = 0;
      this.idleReady = new Promise(resolve => setTimeout(resolve, 30));
    }
    this.host.replaceChildren();
    this.message = '';
  }

  close() {
    this.dispose();
    this.mode = '2d';
    this.playing = this.rotating = false;
    this.update();
  }

  async load() {
    this.invalidate();
    if (!this.active) return;
    this.message = 'loading';
    const token = this.generation;
    const id = this.stage.id;
    const attempt = this.attempts.get(id) || 0;
    this.pendingAssetId = id;
    const source = `${this.assets[id].modelUrl}${attempt ? `?retry=${attempt}` : ''}`;
    const current = () => token === this.generation && this.active && this.stage.id === id;
    const matches = url => url && new URL(url, location.href).href === new URL(source, location.href).href;
    this.slowTimer = setTimeout(() => { if (current()) { this.message = 'slow'; this.update(); } }, 12000);
    this.failureTimer = setTimeout(() => { if (current()) this.fail(id, attempt); }, 45000);
    this.update();
    try {
      verifyGraphics();
      // The separate runtime and studio map are requested only after 3D opt-in.
      const [, environment] = await Promise.all([loadViewerRuntime(), loadStudioEnvironment(this.environmentUrl)]);
      await customElements.whenDefined('model-viewer');
      if (!this.viewer && this.idleViewer) await this.idleReady;
      if (!current()) return;
      customElements.get('model-viewer').modelCacheSize = 1;
      const element = this.viewer || this.idleViewer || document.createElement('model-viewer');
      this.idleViewer = null;
      this.viewer = element;
      const attributes = {
        'camera-controls': '', 'disable-pan': '', 'touch-action': 'pan-y',
        'interaction-prompt': 'none', 'min-camera-orbit': 'auto 40deg 78%',
        'max-camera-orbit': 'auto 100deg 135%', 'field-of-view': '30deg',
        'shadow-intensity': '.55', 'shadow-softness': '.9', exposure: '.95',
        'environment-image': environment, 'rotation-per-second': '6deg',
        'auto-rotate-delay': '500', 'aria-hidden': 'true', tabindex: '-1',
        'interpolation-decay': this.owner.reducedMotionQuery.matches ? '0' : '65',
      };
      for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
      element.cameraOrbit = OPENING_ORBIT;
      this.events = new AbortController();
      const signal = this.events.signal;
      element.addEventListener('load', async event => {
        if (!current() || !matches(event.detail?.url)) return;
        await element.updateComplete;
        if (!current() || !matches(element.src)) return;
        this.frame = requestAnimationFrame(() => {
          this.frame = requestAnimationFrame(() => {
            if (!current() || !matches(element.src) || !element.loaded) return;
            clearTimeout(this.slowTimer);
            clearTimeout(this.failureTimer);
            element.resetTurntableRotation();
            this.ready = true;
            this.pendingAssetId = null;
            this.message = this.owner.reducedMotionQuery.matches ? 'reduced' : 'ready';
            element.removeAttribute('aria-hidden');
            element.removeAttribute('tabindex');
            this.root.dataset.modelReady = 'true';
            this.host.removeAttribute('aria-hidden');
            this.update();
            this.scheduleDwell();
            this.root.dispatchEvent(new CustomEvent('avatar-3d:ready', {detail: {id}}));
          });
        });
      }, {signal});
      element.addEventListener('error', () => { if (current()) this.fail(id, attempt); }, {signal});
      element.addEventListener('camera-change', event => {
        if (event.detail?.source === 'user-interaction') this.pause();
      }, {signal});
      element.src = source;
      if (!element.isConnected) this.host.append(element);
      this.update();
    } catch {
      if (current()) this.fail(id, attempt);
    }
  }

  fail(id, attempt) {
    this.attempts.set(id, attempt + 1);
    this.pendingAssetId = null;
    this.dispose();
    this.failed = true;
    this.message = 'error';
    this.update();
    this.scheduleDwell();
  }

  turn(degrees) {
    if (!this.ready || !this.viewer) return;
    this.pause();
    const orbit = this.viewer.getCameraOrbit();
    this.viewer.cameraOrbit = `${orbit.theta * 180 / Math.PI + degrees}deg ${orbit.phi * 180 / Math.PI}deg ${orbit.radius}m`;
    if (this.owner.reducedMotionQuery.matches) this.viewer.jumpCameraToGoal();
  }

  resetView() {
    if (!this.ready || !this.viewer) return;
    this.viewer.cameraOrbit = OPENING_ORBIT;
    this.viewer.fieldOfView = '30deg';
    this.viewer.resetTurntableRotation();
    if (this.owner.reducedMotionQuery.matches) this.viewer.jumpCameraToGoal();
  }

  update() {
    this.root.dataset.representation = this.mode;
    this.root.querySelectorAll('[data-evolution-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.evolutionMode === this.mode)));
    this.tools.hidden = this.mode !== '3d';
    this.owner.canvas?.setAttribute('role', this.mode === '3d' ? 'group' : 'img');
    const rotating = this.ready && this.active && this.rotating && this.visible && !document.hidden && !this.owner.reducedMotionQuery.matches;
    this.viewer?.toggleAttribute('auto-rotate', rotating);
    if (this.viewer) {
      this.viewer.alt = this.t('viewer').replace('{title}', this.owner.locale === 'es' ? this.stage.titleEs : this.stage.title);
      if (this.viewer.dataset.locale !== this.owner.locale) {
        const a11y = {'interaction-prompt': this.t('help')};
        for (const direction of ['front', 'right', 'back', 'left']) {
          for (const elevation of ['', 'upper-', 'lower-']) {
            a11y[elevation + direction] = this.t(elevation === 'upper-' ? 'viewAbove' : elevation === 'lower-' ? 'viewBelow' : 'viewPosition')
              .replace('{direction}', this.t(`camera${direction[0].toUpperCase()}${direction.slice(1)}`));
          }
        }
        this.viewer.a11y = a11y;
        this.viewer.dataset.locale = this.owner.locale;
      }
    }
    if (this.status) this.status.textContent = this.message ? this.t(this.message) : '';
    this.buttons.forEach(button => {
      const action = button.getAttribute('data-evolution-3d-action');
      button.disabled = action !== 'retry' && !this.ready;
      if (action === 'retry') button.hidden = !this.failed;
      if (action === 'rotation') {
        button.disabled ||= this.owner.reducedMotionQuery.matches;
        button.textContent = this.t(rotating ? 'stopRotation' : 'rotate');
        button.setAttribute('aria-pressed', String(rotating));
      }
    });
    this.owner.render(false);
  }
}
