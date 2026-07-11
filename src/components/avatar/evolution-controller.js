// @ts-check

const TRANSITION_DURATION = 1600;
const STAGE_HOLD_DURATION = 1000;

/**
 * @typedef {Object} AvatarEvolutionStage
 * @property {string} id
 * @property {string} version
 * @property {string} date
 * @property {string} title
 * @property {string} description
 * @property {string} titleEs
 * @property {string} descriptionEs
 * @property {string} vectorImage
 * @property {string} fallbackImage
 */

/**
 * @typedef {Object} TransitionState
 * @property {number} targetIndex
 * @property {boolean} continueAutoplay
 */

class AvatarEvolutionController {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    /** @type {AvatarEvolutionStage[]} */
    this.stages = this.parseStages();
    /** @type {(SVGSVGElement | null)[]} */
    this.svgStages = [];
    /** @type {(HTMLElement | null)[]} */
    this.stageLayers = [];
    /** @type {Animation[]} */
    this.detailAnimations = [];
    /** @type {TransitionState | null} */
    this.transition = null;
    this.index = 0;
    this.active = false;
    this.loaded = false;
    this.loading = false;
    this.fallbackMode = false;
    this.autoplay = false;
    this.paused = false;
    this.activatedThisOpen = false;
    this.completed = false;
    this.holdId = 0;
    this.locale = this.detectLocale();
    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.stageHost = this.root.querySelector('[data-evolution-stage]');
    this.canvas = this.root.querySelector('[data-evolution-canvas]');
    this.fallbackImage = this.root.querySelector('[data-evolution-fallback]');
    this.loadingNode = this.root.querySelector('[data-evolution-loading]');
    this.statusNode = this.root.querySelector('[data-evolution-status]');
    this.noticeNode = this.root.querySelector('[data-evolution-notice]');
    this.titleNode = this.root.querySelector('[data-evolution-title]');
    this.descriptionNode = this.root.querySelector('[data-evolution-description]');
    this.metaNode = this.root.querySelector('[data-evolution-meta]');
    this.progressNode = this.root.querySelector('[data-evolution-progress]');
    this.announcementNode = this.root.querySelector('[data-evolution-announcement]');
    this.markers = Array.from(this.root.querySelectorAll('[data-evolution-marker]'));
    this.effectsNode = this.root.querySelector('[data-evolution-effects]');
    this.scanNode = this.root.querySelector('[data-evolution-scan]');
    this.haloNode = this.root.querySelector('[data-evolution-halo]');
    this.particles = Array.from(this.root.querySelectorAll('[data-evolution-particle]'));
    this.previousButton = this.getButton('previous');
    this.playButton = this.getButton('play');
    this.nextButton = this.getButton('next');
    this.restartButton = this.getButton('restart');
    this.playLabel = this.root.querySelector('[data-evolution-play-label]');
    this.playIcon = this.root.querySelector('[data-evolution-play-icon]');

    if (!this.stages.length || !(this.stageHost instanceof HTMLElement)) return;
    this.bindEvents();
    this.render(false);
  }

  /** @returns {AvatarEvolutionStage[]} */
  parseStages() {
    const node = this.root.querySelector('[data-avatar-evolution-data]');
    if (!node?.textContent) return [];
    try {
      const parsed = JSON.parse(node.textContent);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('[avatar-evolution] Unable to parse stage data', error);
      return [];
    }
  }

  /** @param {string} action */
  getButton(action) {
    const node = this.root.querySelector(`[data-evolution-action="${action}"]`);
    return node instanceof HTMLButtonElement ? node : null;
  }

  bindEvents() {
    this.previousButton?.addEventListener('click', () => this.navigate(-1));
    this.nextButton?.addEventListener('click', () => this.navigate(1));
    this.playButton?.addEventListener('click', () => this.togglePlayback());
    this.restartButton?.addEventListener('click', () => this.restart());

    this.root.addEventListener('avatar-gallery:activate', () => {
      void this.activate();
    });
    this.root.addEventListener('avatar-gallery:deactivate', () => {
      this.active = false;
      this.pause();
    });

    const modal = this.root.closest('[data-avatar-modal]');
    modal?.addEventListener('avatar-gallery:close', () => {
      this.active = false;
      this.resetForNextOpen();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });

    const handleMotionChange = () => {
      if (this.reducedMotionQuery.matches) {
        this.cancelTransition();
        this.autoplay = false;
        this.paused = false;
        this.showStableStage(this.index);
      }
      this.render(false);
      this.updateNotice();
    };
    this.reducedMotionQuery.addEventListener('change', handleMotionChange);

    new MutationObserver(() => {
      const nextLocale = this.detectLocale();
      if (nextLocale !== this.locale) {
        this.locale = nextLocale;
        this.render(false);
        this.updateNotice();
      }
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });
  }

  async activate() {
    this.active = true;
    if (!this.loaded) await this.loadAssets();
    if (!this.active || !this.loaded) return;

    if (!this.activatedThisOpen) {
      this.activatedThisOpen = true;
      this.showStableStage(0);
      if (!this.reducedMotionQuery.matches && !this.fallbackMode) {
        this.startAutoplay();
      }
    }
    this.render(false);
  }

  async loadAssets() {
    if (this.loading || this.loaded) return;
    this.loading = true;
    this.setLoadingStatus(this.translate('avatar.evolution.loading'));

    const results = await Promise.all(
      this.stages.map(async (stage, index) => {
        try {
          const response = await fetch(stage.vectorImage, { credentials: 'same-origin' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const source = await response.text();
          const documentNode = new DOMParser().parseFromString(source, 'image/svg+xml');
          if (documentNode.querySelector('parsererror')) throw new Error('Invalid SVG XML');
          const svg = documentNode.documentElement;
          if (!(svg instanceof SVGSVGElement)) throw new Error('Missing SVG root');

          const layer = document.createElement('div');
          layer.dataset.evolutionLayer = String(index);
          layer.className = 'absolute inset-0 flex items-center justify-center';
          layer.hidden = true;
          layer.setAttribute('aria-hidden', 'true');

          svg.dataset.evolutionSvg = String(index);
          svg.classList.add('h-full', 'w-full', 'object-contain', 'p-1', 'sm:p-3');
          svg.setAttribute('aria-hidden', 'true');
          svg.removeAttribute('role');
          layer.append(svg);
          this.stageHost?.append(layer);
          return { svg, layer };
        } catch (error) {
          console.warn('[avatar-evolution] Vector stage failed to load', { stage: stage.id, error });
          return null;
        }
      }),
    );

    this.svgStages = results.map((result) => result?.svg ?? null);
    this.stageLayers = results.map((result) => result?.layer ?? null);
    this.fallbackMode = results.some((stage) => !stage);
    this.loaded = true;
    this.loading = false;
    if (this.loadingNode instanceof HTMLElement) this.loadingNode.hidden = true;
    this.showStableStage(this.index);
    this.updateNotice();
    this.render(false);
  }

  /** @param {string} value */
  setLoadingStatus(value) {
    if (this.statusNode) this.statusNode.textContent = value;
  }

  updateNotice() {
    if (!(this.noticeNode instanceof HTMLElement)) return;
    let message = '';
    if (this.fallbackMode) {
      message = this.translate('avatar.evolution.loadError');
    } else if (this.reducedMotionQuery.matches) {
      message = this.translate('avatar.evolution.motionReduced');
    }
    this.noticeNode.textContent = message;
    this.noticeNode.hidden = !message;
  }

  startAutoplay() {
    if (!this.active || this.reducedMotionQuery.matches || this.fallbackMode || this.loading) return;
    if (this.index >= this.stages.length - 1) {
      this.showStableStage(0);
    }
    this.autoplay = true;
    this.paused = false;
    this.completed = false;
    if (this.transition) {
      this.resumeTransition();
    } else {
      this.scheduleAdvance();
    }
    this.render(false);
  }

  pause() {
    this.autoplay = false;
    this.clearHold();
    if (this.transition) {
      this.paused = true;
      this.detailAnimations.forEach((animation) => animation.pause());
    }
    this.render(false);
  }

  togglePlayback() {
    if (this.reducedMotionQuery.matches || this.fallbackMode || this.loading) return;
    const isRunning = this.autoplay || (Boolean(this.transition) && !this.paused);
    if (isRunning) {
      this.pause();
      return;
    }
    this.startAutoplay();
  }

  restart() {
    this.cancelTransition();
    this.showStableStage(0);
    if (this.reducedMotionQuery.matches || this.fallbackMode) {
      this.autoplay = false;
      this.render(true);
      return;
    }
    this.startAutoplay();
  }

  /** @param {number} delta */
  navigate(delta) {
    if (this.transition || this.loading) return;
    const target = Math.max(0, Math.min(this.stages.length - 1, this.index + delta));
    if (target === this.index) return;
    this.autoplay = false;
    this.clearHold();
    this.completed = false;

    if (this.reducedMotionQuery.matches || this.fallbackMode) {
      this.showStableStage(target);
      this.render(true);
      return;
    }
    this.startTransition(target, false);
  }

  scheduleAdvance() {
    this.clearHold();
    if (!this.autoplay || !this.active || this.index >= this.stages.length - 1) return;
    this.holdId = window.setTimeout(() => {
      this.holdId = 0;
      if (this.autoplay && this.active) this.startTransition(this.index + 1, true);
    }, STAGE_HOLD_DURATION);
  }

  clearHold() {
    if (this.holdId) window.clearTimeout(this.holdId);
    this.holdId = 0;
  }

  /**
   * @param {number} targetIndex
   * @param {boolean} continueAutoplay
   */
  startTransition(targetIndex, continueAutoplay) {
    const currentLayer = this.stageLayers[this.index];
    const targetLayer = this.stageLayers[targetIndex];
    if (!currentLayer || !targetLayer) {
      this.showStableStage(targetIndex);
      this.autoplay = false;
      this.render(true);
      return;
    }

    const direction = targetIndex > this.index ? 1 : -1;
    currentLayer.hidden = false;
    targetLayer.hidden = false;
    currentLayer.style.zIndex = '1';
    targetLayer.style.zIndex = '2';

    const transition = { targetIndex, continueAutoplay };
    this.transition = transition;
    this.paused = false;
    this.detailAnimations = this.animateTransition(currentLayer, targetLayer, direction);
    const completion = this.detailAnimations.map((animation) => animation.finished.catch(() => undefined));
    void Promise.all(completion).then(() => {
      if (this.transition === transition) this.finishTransition();
    });
    this.render(false);
  }

  resumeTransition() {
    if (!this.transition) return;
    this.paused = false;
    this.transition.continueAutoplay = true;
    this.detailAnimations.forEach((animation) => animation.play());
    this.render(false);
  }

  finishTransition() {
    const transition = this.transition;
    if (!transition) return;
    const shouldContinue = transition.continueAutoplay && this.autoplay;
    const targetIndex = transition.targetIndex;
    this.detailAnimations.forEach((animation) => animation.cancel());
    this.detailAnimations = [];
    this.transition = null;
    this.hideEffects();
    this.showStableStage(targetIndex);
    this.render(true);

    if (targetIndex >= this.stages.length - 1) {
      this.autoplay = false;
      this.completed = true;
      this.render(false);
    } else if (shouldContinue && this.active) {
      this.scheduleAdvance();
    } else {
      this.autoplay = false;
      this.render(false);
    }
  }

  cancelTransition() {
    this.clearHold();
    this.detailAnimations.forEach((animation) => animation.cancel());
    this.detailAnimations = [];
    this.transition = null;
    this.paused = false;
    this.hideEffects();
    this.stageLayers.forEach((layer, layerIndex) => {
      if (!layer) return;
      this.resetLayerStyles(layer);
      layer.hidden = layerIndex !== this.index;
    });
  }

  /**
   * @param {HTMLElement} currentLayer
   * @param {HTMLElement} targetLayer
   * @param {number} direction
   * @returns {Animation[]}
   */
  animateTransition(currentLayer, targetLayer, direction) {
    const revealStart = direction > 0 ? 'inset(0 102% 0 0)' : 'inset(0 0 0 102%)';
    const animations = [
      currentLayer.animate(
        [
          { opacity: 1, transform: 'scale(1)', offset: 0 },
          { opacity: 0.96, transform: 'scale(0.997)', offset: 0.42 },
          { opacity: 0.72, transform: 'scale(0.99)', offset: 0.82 },
          { opacity: 0, transform: 'scale(0.985)', offset: 1 },
        ],
        { duration: TRANSITION_DURATION, easing: 'cubic-bezier(.32,.02,.18,1)', fill: 'both' },
      ),
      targetLayer.animate(
        [
          { clipPath: revealStart, opacity: 0.22, transform: 'scale(1.008)', offset: 0 },
          { clipPath: revealStart, opacity: 0.42, transform: 'scale(1.006)', offset: 0.12 },
          { clipPath: 'inset(0 0 0 0)', opacity: 1, transform: 'scale(1)', offset: 0.88 },
          { clipPath: 'inset(0 0 0 0)', opacity: 1, transform: 'scale(1)', offset: 1 },
        ],
        { duration: TRANSITION_DURATION, easing: 'linear', fill: 'both' },
      ),
    ];

    if (this.effectsNode instanceof HTMLElement) this.effectsNode.hidden = false;
    if (this.scanNode instanceof HTMLElement) {
      const stageWidth = this.canvas instanceof HTMLElement ? this.canvas.clientWidth : currentLayer.clientWidth;
      const start = direction > 0 ? stageWidth * -0.04 : stageWidth * 1.04;
      const end = direction > 0 ? stageWidth * 1.04 : stageWidth * -0.04;
      const skew = direction > 0 ? 'skewX(-8deg)' : 'skewX(8deg)';
      animations.push(
        this.scanNode.animate(
          [
            { opacity: 0, transform: `translate3d(${start}px,0,0) ${skew}`, offset: 0 },
            { opacity: 0.92, transform: `translate3d(${start}px,0,0) ${skew}`, offset: 0.12 },
            { opacity: 0.92, transform: `translate3d(${end}px,0,0) ${skew}`, offset: 0.88 },
            { opacity: 0, transform: `translate3d(${end}px,0,0) ${skew}`, offset: 1 },
          ],
          { duration: TRANSITION_DURATION, easing: 'linear', fill: 'both' },
        ),
      );
    }
    if (this.haloNode instanceof HTMLElement) {
      animations.push(
        this.haloNode.animate(
          [
            { opacity: 0, transform: 'scale(0.94)', offset: 0 },
            { opacity: 0.42, transform: 'scale(1)', offset: 0.38 },
            { opacity: 0.18, transform: 'scale(1.025)', offset: 0.72 },
            { opacity: 0, transform: 'scale(1.04)', offset: 1 },
          ],
          { duration: TRANSITION_DURATION, easing: 'ease-out', fill: 'both' },
        ),
      );
    }
    this.particles.forEach((node, index) => {
      if (!(node instanceof HTMLElement)) return;
      const horizontal = direction * (28 + index * 10);
      const vertical = index % 2 === 0 ? -18 - index * 4 : 14 + index * 3;
      animations.push(
        node.animate(
          [
            { opacity: 0, transform: 'translate3d(0,0,0) scale(.7)', offset: 0 },
            { opacity: 0, transform: 'translate3d(0,0,0) scale(.7)', offset: 0.24 + index * 0.03 },
            { opacity: 0.9, transform: `translate3d(${horizontal * 0.35}px,${vertical * 0.35}px,0) scale(1)`, offset: 0.52 },
            { opacity: 0, transform: `translate3d(${horizontal}px,${vertical}px,0) scale(.5)`, offset: 0.82 + index * 0.02 },
            { opacity: 0, transform: `translate3d(${horizontal}px,${vertical}px,0) scale(.5)`, offset: 1 },
          ],
          { duration: TRANSITION_DURATION, easing: 'ease-out', fill: 'both' },
        ),
      );
    });
    return animations;
  }

  hideEffects() {
    if (this.effectsNode instanceof HTMLElement) this.effectsNode.hidden = true;
  }

  /** @param {HTMLElement} layer */
  resetLayerStyles(layer) {
    layer.style.removeProperty('opacity');
    layer.style.removeProperty('transform');
    layer.style.removeProperty('clip-path');
    layer.style.removeProperty('z-index');
  }

  /** @param {number} index */
  showStableStage(index) {
    this.index = index;
    this.completed = index === this.stages.length - 1;
    this.stageLayers.forEach((layer, layerIndex) => {
      if (!layer) return;
      this.resetLayerStyles(layer);
      layer.hidden = layerIndex !== index;
    });
    this.hideEffects();

    const activeSvg = this.svgStages[index];
    if (this.fallbackImage instanceof HTMLImageElement) {
      const shouldShowFallback = !activeSvg;
      this.fallbackImage.hidden = !shouldShowFallback;
      this.fallbackImage.classList.toggle('hidden', !shouldShowFallback);
      if (shouldShowFallback) this.fallbackImage.src = this.stages[index].fallbackImage;
    }
  }

  resetForNextOpen() {
    this.cancelTransition();
    this.autoplay = false;
    this.activatedThisOpen = false;
    this.completed = false;
    if (this.loaded) this.showStableStage(0);
    this.render(false);
  }

  /** @param {boolean} announce */
  render(announce) {
    const stage = this.stages[this.index];
    if (!stage) return;
    const title = this.locale === 'es' ? stage.titleEs : stage.title;
    const description = this.locale === 'es' ? stage.descriptionEs : stage.description;
    const current = String(this.index + 1);
    const total = String(this.stages.length);

    if (this.titleNode) this.titleNode.textContent = title;
    if (this.descriptionNode) this.descriptionNode.textContent = description;
    if (this.metaNode) this.metaNode.textContent = `${stage.version} • ${stage.date}`;
    if (this.progressNode) {
      this.progressNode.textContent = this.translate('avatar.evolution.progress')
        .replace('{current}', current)
        .replace('{total}', total);
    }
    if (this.canvas) {
      this.canvas.setAttribute('aria-label', `${stage.version}: ${title}. ${description}`);
    }
    if (announce && this.announcementNode) {
      this.announcementNode.textContent = this.translate('avatar.evolution.announcement')
        .replace('{version}', stage.version)
        .replace('{title}', title)
        .replace('{current}', current)
        .replace('{total}', total);
    }

    this.markers.forEach((marker, markerIndex) => {
      if (marker instanceof HTMLElement) marker.dataset.active = String(markerIndex === this.index);
    });

    const transitionRunning = Boolean(this.transition) && !this.paused;
    const showPause = this.autoplay || transitionRunning;
    if (this.playLabel) {
      this.playLabel.textContent = this.translate(showPause ? 'avatar.evolution.pause' : 'avatar.evolution.play');
    }
    if (this.playIcon) this.playIcon.textContent = showPause ? 'Ⅱ' : '▶';
    if (this.playButton) {
      const label = this.translate(showPause ? 'avatar.evolution.pause' : 'avatar.evolution.play');
      this.playButton.setAttribute('aria-label', label);
      this.playButton.disabled = this.loading || this.fallbackMode || this.reducedMotionQuery.matches;
    }
    if (this.previousButton) this.previousButton.disabled = this.loading || Boolean(this.transition) || this.index === 0;
    if (this.nextButton) this.nextButton.disabled = this.loading || Boolean(this.transition) || this.index === this.stages.length - 1;
    if (this.restartButton) this.restartButton.disabled = this.loading;
  }

  detectLocale() {
    return document.documentElement.lang.toLowerCase().startsWith('es') ? 'es' : 'en';
  }

  /** @param {string} key */
  translate(key) {
    const store = /** @type {Window & { turtleandLocaleStore?: { t?: (key: string) => string } }} */ (window)
      .turtleandLocaleStore;
    const value = store?.t?.(key);
    if (value && value !== key) return value;

    const fallback = {
      'avatar.evolution.loading': this.locale === 'es' ? 'Cargando la evolución vectorial' : 'Loading vector evolution',
      'avatar.evolution.loadError': this.locale === 'es' ? 'La animación vectorial no está disponible. Se muestran las imágenes originales.' : 'Vector animation unavailable. Showing original images.',
      'avatar.evolution.motionReduced': this.locale === 'es' ? 'El movimiento está reducido. Usa Anterior y Siguiente para explorar.' : 'Motion is reduced. Use Previous and Next to explore.',
      'avatar.evolution.play': this.locale === 'es' ? 'Reproducir' : 'Play',
      'avatar.evolution.pause': this.locale === 'es' ? 'Pausar' : 'Pause',
      'avatar.evolution.progress': this.locale === 'es' ? 'Etapa {current} de {total}' : 'Stage {current} of {total}',
      'avatar.evolution.announcement': this.locale === 'es' ? 'Mostrando {version}, {title}. Etapa {current} de {total}.' : 'Now showing {version}, {title}. Stage {current} of {total}.',
    };
    return fallback[key] ?? key;
  }
}

const initAvatarEvolution = () => {
  document.querySelectorAll('[data-avatar-evolution]').forEach((node) => {
    if (node instanceof HTMLElement) new AvatarEvolutionController(node);
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAvatarEvolution, { once: true });
} else {
  initAvatarEvolution();
}

export { AvatarEvolutionController };
