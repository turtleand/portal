// @ts-check

const TRANSITION_DURATION = 2200;
const STAGE_HOLD_DURATION = 1000;
const NUMBER_PATTERN = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

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
 * @typedef {Object} MorphPair
 * @property {SVGPathElement} path
 * @property {string} template
 * @property {number[]} from
 * @property {number[]} to
 */

/**
 * @typedef {Object} TransitionState
 * @property {number} targetIndex
 * @property {number} elapsed
 * @property {number | null} lastTimestamp
 * @property {boolean} continueAutoplay
 * @property {MorphPair[]} pairs
 */

class AvatarEvolutionController {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = root;
    /** @type {AvatarEvolutionStage[]} */
    this.stages = this.parseStages();
    /** @type {(SVGSVGElement | null)[]} */
    this.svgStages = [];
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
    this.frameId = 0;
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

          svg.dataset.evolutionSvg = String(index);
          svg.classList.add('absolute', 'inset-0', 'h-full', 'w-full', 'object-contain', 'p-1', 'sm:p-3');
          svg.setAttribute('aria-hidden', 'true');
          svg.removeAttribute('role');
          svg.style.display = 'none';
          svg.querySelectorAll('[data-morph-key]').forEach((node) => {
            if (node instanceof SVGPathElement) node.dataset.originalD = node.getAttribute('d') ?? '';
          });
          this.stageHost?.append(svg);
          return svg;
        } catch (error) {
          console.warn('[avatar-evolution] Vector stage failed to load', { stage: stage.id, error });
          return null;
        }
      }),
    );

    this.svgStages = results;
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
      window.cancelAnimationFrame(this.frameId);
      this.frameId = 0;
      this.transition.lastTimestamp = null;
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
    const currentSvg = this.svgStages[this.index];
    const targetSvg = this.svgStages[targetIndex];
    if (!currentSvg || !targetSvg) {
      this.showStableStage(targetIndex);
      this.autoplay = false;
      this.render(true);
      return;
    }

    this.restoreMorphPaths(currentSvg);
    this.restoreMorphPaths(targetSvg);
    currentSvg.style.display = '';
    targetSvg.style.display = '';
    currentSvg.style.opacity = '1';
    targetSvg.style.opacity = '0';
    targetSvg.style.transformOrigin = '50% 58%';

    const pairs = this.createMorphPairs(currentSvg, targetSvg);
    this.transition = {
      targetIndex,
      elapsed: 0,
      lastTimestamp: null,
      continueAutoplay,
      pairs,
    };
    this.paused = false;
    this.detailAnimations = this.animateTransitionDetails(currentSvg, targetSvg);
    this.frameId = window.requestAnimationFrame((timestamp) => this.tickTransition(timestamp));
    this.render(false);
  }

  /** @param {number} timestamp */
  tickTransition(timestamp) {
    const transition = this.transition;
    if (!transition || this.paused) return;
    if (transition.lastTimestamp == null) transition.lastTimestamp = timestamp;
    const delta = Math.min(48, timestamp - transition.lastTimestamp);
    transition.lastTimestamp = timestamp;
    transition.elapsed += delta;
    const rawProgress = Math.min(1, transition.elapsed / TRANSITION_DURATION);
    const progress = rawProgress < 0.5
      ? 4 * rawProgress * rawProgress * rawProgress
      : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2;

    transition.pairs.forEach((pair) => {
      let numberIndex = 0;
      const nextD = pair.template.replace(NUMBER_PATTERN, () => {
        const value = pair.from[numberIndex] + (pair.to[numberIndex] - pair.from[numberIndex]) * progress;
        numberIndex += 1;
        return Number(value.toFixed(2)).toString();
      });
      pair.path.setAttribute('d', nextD);
    });

    if (rawProgress >= 1) {
      this.finishTransition();
      return;
    }
    this.frameId = window.requestAnimationFrame((nextTimestamp) => this.tickTransition(nextTimestamp));
  }

  resumeTransition() {
    if (!this.transition) return;
    this.paused = false;
    this.transition.continueAutoplay = true;
    this.transition.lastTimestamp = null;
    this.detailAnimations.forEach((animation) => animation.play());
    this.frameId = window.requestAnimationFrame((timestamp) => this.tickTransition(timestamp));
  }

  finishTransition() {
    const transition = this.transition;
    if (!transition) return;
    const shouldContinue = transition.continueAutoplay && this.autoplay;
    const targetIndex = transition.targetIndex;
    this.detailAnimations.forEach((animation) => animation.cancel());
    this.detailAnimations = [];
    this.transition = null;
    this.frameId = 0;
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
    window.cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.detailAnimations.forEach((animation) => animation.cancel());
    this.detailAnimations = [];
    this.transition = null;
    this.paused = false;
    this.svgStages.forEach((svg) => {
      if (!svg) return;
      this.restoreMorphPaths(svg);
      svg.style.removeProperty('opacity');
      svg.style.removeProperty('transform');
    });
  }

  /**
   * @param {SVGSVGElement} currentSvg
   * @param {SVGSVGElement} targetSvg
   * @returns {MorphPair[]}
   */
  createMorphPairs(currentSvg, targetSvg) {
    /** @type {MorphPair[]} */
    const pairs = [];
    currentSvg.querySelectorAll('[data-morph-key]').forEach((node) => {
      if (!(node instanceof SVGPathElement)) return;
      const key = node.dataset.morphKey;
      if (!key) return;
      const target = targetSvg.querySelector(`[data-morph-key="${key}"]`);
      if (!(target instanceof SVGPathElement)) return;
      const fromD = node.getAttribute('d') ?? '';
      const toD = target.getAttribute('d') ?? '';
      const fromNumbers = (fromD.match(NUMBER_PATTERN) ?? []).map(Number);
      const toNumbers = (toD.match(NUMBER_PATTERN) ?? []).map(Number);
      const fromCommands = fromD.replace(NUMBER_PATTERN, '').replace(/[\s,]+/g, '');
      const toCommands = toD.replace(NUMBER_PATTERN, '').replace(/[\s,]+/g, '');
      if (fromNumbers.length !== toNumbers.length || fromCommands !== toCommands) return;
      pairs.push({ path: node, template: fromD, from: fromNumbers, to: toNumbers });
    });
    return pairs;
  }

  /**
   * @param {SVGSVGElement} currentSvg
   * @param {SVGSVGElement} targetSvg
   * @returns {Animation[]}
   */
  animateTransitionDetails(currentSvg, targetSvg) {
    /** @type {Animation[]} */
    const animations = [];
    animations.push(
      currentSvg.animate(
        [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.68 }, { opacity: 0, offset: 1 }],
        { duration: TRANSITION_DURATION, easing: 'ease-in-out', fill: 'both' },
      ),
    );
    animations.push(
      targetSvg.animate(
        [
          { opacity: 0, transform: 'scale(0.97)', offset: 0 },
          { opacity: 0, transform: 'scale(0.98)', offset: 0.48 },
          { opacity: 1, transform: 'scale(1)', offset: 1 },
        ],
        { duration: TRANSITION_DURATION, easing: 'cubic-bezier(.22,.75,.25,1)', fill: 'both' },
      ),
    );

    const currentArtwork = currentSvg.querySelector('[data-group="artwork"]');
    const targetArtwork = targetSvg.querySelector('[data-group="artwork"]');
    if (currentArtwork instanceof SVGElement) {
      animations.push(
        currentArtwork.animate(
          [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 0.34 }, { opacity: 0, offset: 1 }],
          { duration: TRANSITION_DURATION, easing: 'ease-in', fill: 'both' },
        ),
      );
    }
    if (targetArtwork instanceof SVGElement) {
      animations.push(
        targetArtwork.animate(
          [{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.66 }, { opacity: 1, offset: 1 }],
          { duration: TRANSITION_DURATION, easing: 'ease-out', fill: 'both' },
        ),
      );
    }

    ['circuits', 'accessories', 'map'].forEach((groupName, groupIndex) => {
      const group = targetSvg.querySelector(`[data-group="${groupName}"]`);
      if (!(group instanceof SVGElement)) return;
      group.style.transformOrigin = '50% 55%';
      animations.push(
        group.animate(
          [
            { opacity: 0, transform: `scale(${0.9 + groupIndex * 0.02})`, offset: 0 },
            { opacity: 0, transform: 'scale(0.96)', offset: 0.42 },
            { opacity: 1, transform: 'scale(1)', offset: 1 },
          ],
          { duration: TRANSITION_DURATION, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
        ),
      );
      group.querySelectorAll('path').forEach((path) => {
        if (!(path instanceof SVGPathElement)) return;
        try {
          const length = path.getTotalLength();
          path.style.strokeDasharray = `${length}`;
          animations.push(
            path.animate(
              [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
              { duration: TRANSITION_DURATION * 0.72, delay: TRANSITION_DURATION * 0.25, easing: 'ease-out', fill: 'both' },
            ),
          );
        } catch {
          // Some filled accessory paths do not expose a usable length.
        }
      });
    });
    return animations;
  }

  /** @param {SVGSVGElement} svg */
  restoreMorphPaths(svg) {
    svg.querySelectorAll('[data-morph-key]').forEach((node) => {
      if (node instanceof SVGPathElement && node.dataset.originalD) {
        node.setAttribute('d', node.dataset.originalD);
      }
    });
  }

  /** @param {number} index */
  showStableStage(index) {
    this.index = index;
    this.completed = index === this.stages.length - 1;
    this.svgStages.forEach((svg, svgIndex) => {
      if (!svg) return;
      this.restoreMorphPaths(svg);
      svg.style.display = svgIndex === index ? '' : 'none';
      svg.style.removeProperty('opacity');
      svg.style.removeProperty('transform');
    });

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
