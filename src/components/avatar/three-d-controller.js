import viewerRuntimeUrl from '@google/model-viewer/dist/model-viewer.min.js?url';

const OPENING_ANGLE = '-43deg 81deg';
const DWELL_MS = 3500;
const FADE_MS = 300;
const DEPENDENCY_TIMEOUT_MS = 20000;
const MODEL_TIMEOUT_MS = 30000;
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

async function downloadModel(source, signal) {
  const response = await fetch(source, {credentials: 'same-origin', signal});
  if (!response.ok) throw new Error('3D model unavailable');
  const buffer = await response.arrayBuffer();
  // Reject an HTML error response or truncated transfer before the renderer
  // allocates a scene. Production validation checks the complete glTF structure.
  if (buffer.byteLength < 12) throw new Error('3D model is invalid');
  const header = new DataView(buffer, 0, 12);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== buffer.byteLength) {
    throw new Error('3D model is invalid');
  }
  return new Blob([buffer], {type: 'model/gltf-binary'});
}

/** Optional 3D presentation. The evolution controller owns the committed chapter. */
export class AvatarThreeDController {
  constructor(owner, assets, environmentUrl) {
    this.owner = owner;
    this.assets = assets;
    this.environmentUrl = environmentUrl;
    this.root = owner.root;
    this.host = this.root.querySelector('[data-evolution-model-host]');
    this.tools = this.root.querySelector('[data-evolution-3d-tools]');
    this.status = this.root.querySelector('[data-evolution-3d-status]');
    this.retryButton = this.root.querySelector('[data-evolution-3d-action="retry"]');
    this.mode = '2d';
    this.viewer = null;
    this.viewerIndex = null;
    this.idleViewer = null;
    this.idleReady = Promise.resolve();
    this.generation = 0;
    this.pendingIndex = null;
    this.ready = false;
    this.failed = false;
    this.playing = false;
    this.visible = false;
    this.attempts = new Map();
    this.message = '';
    this.root.querySelectorAll('[data-evolution-mode]').forEach(button => {
      button.addEventListener('click', () => this.setMode(button.dataset.evolutionMode));
    });
    this.retryButton?.addEventListener('click', () => { void this.load(this.owner.index); });
    new IntersectionObserver(entries => {
      this.visible = entries.some(entry => entry.isIntersecting);
      if (this.visible) this.scheduleDwell();
      else {
        this.pauseDwell();
        this.cancelPrefetch();
      }
      this.update();
    }, {threshold: .05}).observe(owner.canvas);
    new ResizeObserver(() => {
      if (this.viewer) this.viewer.minCameraOrbit = this.viewFraming().minimum;
    }).observe(owner.canvas);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.active) {
        this.playing = false;
        this.dispose();
      } else if (this.active && !this.viewer) {
        void this.load(this.owner.index);
      }
      this.update();
    });
    owner.reducedMotionQuery.addEventListener('change', () => {
      if (owner.reducedMotionQuery.matches) {
        this.pause();
        if (this.snapshotFade) this.clearSnapshot();
      }
      this.viewer?.setAttribute('interpolation-decay', owner.reducedMotionQuery.matches ? '0' : '65');
      this.update();
    });
    this.update();
  }

  get active() { return this.mode === '3d' && this.owner.active; }
  get stage() { return this.owner.stages[this.owner.index]; }
  t(key) { return this.owner.translate(`avatar.threeD.${key}`); }

  viewFraming() {
    const aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight);
    // Leave enough horizontal room for the full shell and muzzle as they orbit.
    const minimum = Math.min(130, Math.max(78, Math.ceil(101 / aspect)));
    return {
      minimum: `auto 40deg ${minimum}%`,
      opening: `${OPENING_ANGLE} ${Math.max(84, minimum + 5)}%`,
    };
  }

  setMode(next) {
    if (!['2d', '3d'].includes(next) || next === this.mode || !this.owner.active || this.owner.loading) return;
    const resume2d = this.playing;
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
      this.playing = !this.owner.reducedMotionQuery.matches && this.owner.index < this.owner.stages.length - 1;
      void this.load(this.owner.index);
    } else {
      this.playing = false;
      this.dispose();
      if (resume2d && !this.owner.reducedMotionQuery.matches) this.owner.startAutoplay();
    }
    this.update();
  }

  select(index, continuePlaying = false) {
    if (!this.active || !this.owner.stages[index]) return;
    this.playing = continuePlaying;
    this.clearDwell();
    if (continuePlaying && index === this.owner.index + 1) this.writeDwellProgress(0);
    if (index === this.pendingIndex) {
      // Taking over a pending tour step makes it a manual selection without rereading the model.
      this.pendingFromTour = continuePlaying && this.pendingFromTour;
      this.update();
      return;
    }
    if (index === this.viewerIndex && this.ready) {
      this.cancelPending();
      this.cancelPrefetch();
      this.message = '';
      this.scheduleDwell();
      this.update();
      return;
    }
    void this.load(index, continuePlaying);
  }

  togglePlayback() {
    if (this.playing) return this.pause();
    if (this.failed) return;
    this.playing = true;
    if (this.owner.index === this.owner.stages.length - 1 && this.pendingIndex === null) {
      this.select(0, true);
    } else {
      this.scheduleDwell();
      this.update();
    }
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.pauseDwell();
    this.cancelPrefetch();
    if (this.pendingFromTour && this.pendingIndex !== null && this.pendingIndex !== this.owner.index) {
      this.select(this.owner.index);
    } else {
      this.update();
    }
  }

  restart() {
    this.select(0, true);
  }

  clearDwell() {
    clearTimeout(this.dwellTimer);
    cancelAnimationFrame(this.dwellFrame);
    this.dwellTimer = 0;
    this.dwellFrame = 0;
    this.dwellRemaining = null;
    this.root.style.setProperty('--evolution-tour-progress', '0');
  }

  pauseDwell() {
    if (!this.dwellTimer) return;
    this.dwellRemaining = Math.max(0, this.dwellDeadline - performance.now());
    this.writeDwellProgress(this.dwellRemaining);
    clearTimeout(this.dwellTimer);
    cancelAnimationFrame(this.dwellFrame);
    this.dwellTimer = 0;
    this.dwellFrame = 0;
  }

  writeDwellProgress(remaining) {
    const progress = Math.max(0, Math.min(1, 1 - remaining / DWELL_MS));
    this.root.style.setProperty('--evolution-tour-progress', progress.toFixed(3));
  }

  scheduleDwell() {
    if (!this.active || !this.playing || !this.visible || document.hidden || !this.ready || this.pendingIndex !== null || this.dwellTimer) return;
    if (this.owner.index === this.owner.stages.length - 1) return;
    const duration = this.dwellRemaining ?? DWELL_MS;
    this.dwellDeadline = performance.now() + duration;
    this.dwellTimer = setTimeout(() => {
      this.dwellTimer = 0;
      if (this.active && this.playing) this.select(this.owner.index + 1, true);
    }, duration);
    const tick = now => {
      this.writeDwellProgress(this.dwellDeadline - now);
      if (this.dwellTimer) this.dwellFrame = requestAnimationFrame(tick);
    };
    this.dwellFrame = requestAnimationFrame(tick);
    this.prefetchNext();
  }

  prefetchNext() {
    const index = this.owner.index + 1;
    if (this.prefetch?.index === index || !this.owner.stages[index]) return;
    this.cancelPrefetch();
    const source = this.modelSource(index);
    const controller = new AbortController();
    // Keep at most the next transfer, and do so only during a visible 3D tour.
    // Parse or upload it only after the chapter is actually selected.
    this.prefetch = {
      index, source, controller, result: downloadModel(source, controller.signal).catch(() => null),
    };
  }

  cancelPrefetch() {
    this.prefetch?.controller.abort();
    this.prefetch = null;
  }

  modelSource(index) {
    const id = this.owner.stages[index].id;
    const attempt = this.attempts.get(id) || 0;
    return `${this.assets[id].modelUrl}${attempt ? `?retry=${attempt}` : ''}`;
  }

  takeModel(index, source) {
    const prefetched = this.prefetch?.index === index && this.prefetch.source === source ? this.prefetch : null;
    if (prefetched) {
      this.prefetch = null;
      this.downloadAbort = prefetched.controller;
      return prefetched.result.then(model => model ?? downloadModel(source, prefetched.controller.signal));
    }
    this.cancelPrefetch();
    this.downloadAbort = new AbortController();
    return downloadModel(source, this.downloadAbort.signal);
  }

  cancelPending() {
    this.pendingIndex = null;
    this.pendingFromTour = false;
    ++this.generation;
    this.downloadAbort?.abort();
    this.downloadAbort = null;
    this.loadEvents?.abort();
    this.loadEvents = null;
    clearTimeout(this.slowTimer);
    clearTimeout(this.failureTimer);
    cancelAnimationFrame(this.frame);
    if (this.viewer && this.viewerIndex === null) {
      this.viewer.src = null;
      delete this.viewer.dataset.modelSource;
    }
    this.releaseModelUrl();
  }

  releaseModelUrl() {
    if (this.modelObjectUrl) URL.revokeObjectURL(this.modelObjectUrl);
    this.modelObjectUrl = null;
  }

  clearSnapshot() {
    this.snapshotFade?.cancel();
    this.incomingFade?.cancel();
    this.snapshotFade = this.incomingFade = null;
    if (this.snapshot) {
      URL.revokeObjectURL(this.snapshot.src);
      this.snapshot.remove();
      this.snapshot = null;
    }
    this.viewer?.style.removeProperty('opacity');
  }

  async captureOutgoing(current) {
    // Reuse the committed frame if a rapid selection interrupts a model decode.
    if (this.snapshot && !this.snapshotFade) return;
    this.clearSnapshot();
    if (!this.viewer?.loaded || this.viewerIndex === null) return;
    let snapshot;
    try {
      const frame = await this.viewer.toBlob({ mimeType: 'image/png', idealAspect: false });
      if (!current()) return;
      snapshot = new Image();
      snapshot.src = URL.createObjectURL(frame);
      await snapshot.decode();
      if (!current()) {
        URL.revokeObjectURL(snapshot.src);
        return;
      }
      snapshot.alt = '';
      snapshot.setAttribute('aria-hidden', 'true');
      snapshot.setAttribute('data-evolution-3d-snapshot', '');
      Object.assign(snapshot.style, {
        position: 'absolute', inset: '0', width: '100%', height: '100%',
        objectFit: 'contain', pointerEvents: 'none',
      });
      this.snapshot = snapshot;
      this.host.append(snapshot);
    } catch {
      if (snapshot) URL.revokeObjectURL(snapshot.src);
    }
  }

  revealIncoming() {
    if (!this.snapshot || this.owner.reducedMotionQuery.matches) {
      this.clearSnapshot();
      return;
    }
    const timing = {duration: FADE_MS, easing: 'ease-out'};
    this.viewer.style.removeProperty('opacity');
    this.incomingFade = this.viewer.animate([{opacity: 0}, {opacity: 1}], timing);
    this.snapshotFade = this.snapshot.animate([{opacity: 1}, {opacity: 0}], timing);
    this.snapshotFade.onfinish = () => this.clearSnapshot();
  }

  dispose() {
    this.cancelPending();
    this.cancelPrefetch();
    this.clearDwell();
    this.clearSnapshot();
    this.ready = this.failed = false;
    if (this.viewer) {
      const retired = this.viewer;
      this.viewer = null;
      this.viewerIndex = null;
      retired.pause();
      retired.src = null;
      retired.removeAttribute('src');
      retired.removeAttribute('environment-image');
      retired.remove();
      // Reuse one empty component shell. Repeated creation retained listener allocations in v4.3.1.
      this.idleViewer = retired;
      customElements.get('model-viewer').modelCacheSize = 0;
      this.idleReady = new Promise(resolve => setTimeout(resolve, 30));
    }
    this.message = '';
  }

  close() {
    this.playing = false;
    this.dispose();
    this.mode = '2d';
    this.update();
  }

  getViewer(environment) {
    if (this.viewer) return this.viewer;
    const element = this.idleViewer || document.createElement('model-viewer');
    const firstUse = !this.idleViewer;
    this.idleViewer = null;
    this.viewer = element;
    const framing = this.viewFraming();
    const attributes = {
      loading: 'eager', reveal: 'auto',
      'camera-controls': '', 'disable-pan': '', 'touch-action': 'pan-y',
      'interaction-prompt': 'none', 'min-camera-orbit': framing.minimum,
      'max-camera-orbit': 'auto 100deg 135%', 'field-of-view': '30deg',
      'shadow-intensity': '1.15', 'shadow-softness': '.82', exposure: '1.05',
      'environment-image': environment,
      'interpolation-decay': this.owner.reducedMotionQuery.matches ? '0' : '65',
    };
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (firstUse) {
      element.addEventListener('error', event => {
        if (event.detail?.type === 'webglcontextlost' && this.active && this.viewer === element) {
          graphicsVerified = false;
          this.fail(this.pendingIndex ?? this.owner.index);
        }
      });
      element.addEventListener('camera-change', event => {
        if (event.detail?.source === 'user-interaction') this.pause();
      });
      element.addEventListener('focusin', () => {
        if (element.matches(':focus-visible') || element.shadowRoot?.activeElement?.matches(':focus-visible')) this.pause();
      });
      element.addEventListener('keydown', event => {
        if (event.key !== 'Home' || this.viewerIndex === null) return;
        event.preventDefault();
        this.pause();
        element.cameraOrbit = this.viewFraming().opening;
        element.fieldOfView = '30deg';
        element.resetTurntableRotation();
        if (this.owner.reducedMotionQuery.matches) element.jumpCameraToGoal();
      });
    }
    return element;
  }

  async load(index, fromTour = false) {
    this.cancelPending();
    if (!this.active) return;
    this.pendingIndex = index;
    this.pendingFromTour = fromTour;
    this.failed = false;
    this.message = this.ready ? '' : 'loading';
    const token = this.generation;
    const id = this.owner.stages[index].id;
    const source = this.modelSource(index);
    const current = () => token === this.generation && this.active;
    this.slowTimer = setTimeout(() => { if (current()) { this.message = 'slow'; this.update(); } }, 4000);
    this.failureTimer = setTimeout(() => { if (current()) this.fail(index); }, MODEL_TIMEOUT_MS);
    this.update();
    try {
      verifyGraphics();
      const [, environment, model] = await Promise.all([
        loadViewerRuntime(), loadStudioEnvironment(this.environmentUrl), this.takeModel(index, source),
      ]);
      if (!this.viewer && this.idleViewer) await this.idleReady;
      if (!current()) return;
      this.downloadAbort = null;
      if (this.ready) await this.captureOutgoing(current);
      if (!current()) return;

      const element = this.getViewer(environment);
      this.viewerIndex = null;
      if (this.ready && !this.snapshot) this.ready = false;
      element.pause();
      element.style.opacity = this.snapshot ? '0' : '';
      element.cameraOrbit = this.viewFraming().opening;
      this.modelObjectUrl = URL.createObjectURL(model);
      const modelSource = `${this.modelObjectUrl}#model.glb`;
      this.loadEvents = new AbortController();
      const signal = this.loadEvents.signal;
      element.addEventListener('load', async event => {
        if (!current() || event.detail?.url !== modelSource) return;
        await element.updateComplete;
        if (!current() || !element.loaded) return;
        this.frame = requestAnimationFrame(() => {
          if (current() && element.src === modelSource && element.loaded) this.commit(element, index, id);
        });
      }, {signal});
      element.addEventListener('error', event => {
        if (event.detail?.type === 'loadfailure' && current() && element.src === modelSource) this.fail(index);
      }, {signal});
      customElements.get('model-viewer').modelCacheSize = 1;
      element.dataset.modelSource = source;
      element.src = modelSource;
      if (!element.isConnected) this.host.append(element);
      this.update();
    } catch {
      if (current()) this.fail(index);
    }
  }

  commit(element, index, id) {
    clearTimeout(this.slowTimer);
    clearTimeout(this.failureTimer);
    this.loadEvents?.abort();
    this.loadEvents = null;
    this.releaseModelUrl();
    element.resetTurntableRotation();
    element.jumpCameraToGoal();
    const animations = element.availableAnimations;
    element.animationName = animations.find(name => /^idle$/i.test(name)) || animations[0];
    element.animationCrossfadeDuration = 0;
    element.currentTime = 0;
    const changed = this.owner.index !== index;
    const announce = changed && !this.pendingFromTour;
    this.viewerIndex = index;
    this.clearDwell();
    this.pendingIndex = null;
    this.pendingFromTour = false;
    this.ready = true;
    this.message = '';
    if (index === this.owner.stages.length - 1) this.playing = false;
    this.owner.showStableStage(index);
    this.update(announce);
    if (changed) this.revealIncoming();
    else this.clearSnapshot();
    this.scheduleDwell();
    this.root.dispatchEvent(new CustomEvent('avatar-3d:ready', {detail: {id, index}}));
  }

  fail(index) {
    const id = this.owner.stages[index].id;
    this.attempts.set(id, (this.attempts.get(id) || 0) + 1);
    const announce = this.owner.index !== index && !this.pendingFromTour;
    this.playing = false;
    this.dispose();
    this.failed = true;
    this.message = 'error';
    this.owner.showStableStage(index);
    this.update(announce);
  }

  update(announce = false) {
    this.root.dataset.representation = this.mode;
    this.root.dataset.modelReady = String(this.ready);
    if (this.pendingIndex === null) delete this.root.dataset.modelPending;
    else this.root.dataset.modelPending = String(this.pendingIndex);
    this.root.querySelectorAll('[data-evolution-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.evolutionMode === this.mode)));
    this.tools.hidden = this.mode !== '3d';
    this.owner.canvas?.setAttribute('role', this.mode === '3d' ? 'group' : 'img');
    this.host.setAttribute('aria-hidden', String(!this.ready));
    if (this.viewer) {
      const operable = this.ready && this.viewerIndex !== null && this.active;
      if (operable) {
        this.viewer.removeAttribute('aria-hidden');
        this.viewer.removeAttribute('tabindex');
      } else {
        this.viewer.setAttribute('aria-hidden', 'true');
        this.viewer.setAttribute('tabindex', '-1');
      }
      const animating = operable && this.playing && this.visible && !document.hidden && !this.owner.reducedMotionQuery.matches;
      if (animating && this.viewer.availableAnimations.length) {
        if (this.viewer.paused) this.viewer.play();
      } else this.viewer.pause();
      this.viewer.alt = this.t('viewer').replace('{title}', this.owner.locale === 'es' ? this.stage.titleEs : this.stage.title);
      if (this.viewer.dataset.locale !== this.owner.locale) {
        const a11y = {'interaction-prompt': this.t('keyboardHelp')};
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
    if (this.retryButton) this.retryButton.hidden = !this.failed;
    this.owner.render(announce);
  }
}
