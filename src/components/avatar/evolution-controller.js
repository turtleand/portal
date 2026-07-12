// @ts-check

const TRANSITION_DURATION = 1600;
const WALK_DURATION = 1800;
const POST_WALK_HOLD_DURATION = 650;

/** @typedef {'rest' | 'contact-a' | 'passing' | 'contact-b'} WalkPose */

/**
 * @typedef {Object} AvatarWalkPoses
 * @property {string} contactA
 * @property {string} passing
 * @property {string} contactB
 */

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
 * @property {AvatarWalkPoses=} walkPoses
 */

/**
 * @typedef {Object} TransitionState
 * @property {number} targetIndex
 * @property {boolean} continueAutoplay
 * @property {Animation[]} animations
 */

/**
 * @typedef {Object} WalkState
 * @property {'walk'} type
 * @property {number} stageIndex
 * @property {number} visitId
 * @property {Animation} avatarAnimation
 * @property {Animation | null} shadowAnimation
 * @property {number} frameId
 */

/** @typedef {({ type: 'transition' } & TransitionState) | WalkState} MotionState */

/**
 * @typedef {Object} WalkPoseLayers
 * @property {HTMLImageElement} contactA
 * @property {HTMLImageElement} passing
 * @property {HTMLImageElement} contactB
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
    /** @type {(WalkPoseLayers | null | undefined)[]} */
    this.walkPoseLayers = [];
    /** @type {(Promise<WalkPoseLayers | null> | undefined)[]} */
    this.walkPosePromises = [];
    /** @type {MotionState | null} */
    this.motion = null;
    this.index = 0;
    this.active = false;
    this.loaded = false;
    this.loading = false;
    this.fallbackMode = false;
    this.poseFailure = false;
    this.unavailableStageIndex = -1;
    this.autoplay = false;
    this.resumeAutoplay = false;
    this.paused = false;
    this.activatedThisOpen = false;
    this.completed = false;
    this.holdId = 0;
    this.holdDeadline = 0;
    this.holdRemaining = 0;
    this.visitId = 0;
    /** @type {'idle' | 'loading' | 'walking' | 'complete' | 'skipped'} */
    this.visitWalkState = 'idle';
    this.locale = this.detectLocale();
    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.stageHost = this.root.querySelector('[data-evolution-stage]');
    this.canvas = this.root.querySelector('[data-evolution-canvas]');
    this.staticFallbackImage = this.root.querySelector('[data-evolution-static-fallback]');
    this.loadingNode = this.root.querySelector('[data-evolution-loading]');
    this.loadingLabelNode = this.root.querySelector('[data-evolution-loading-label]');
    this.statusNode = this.root.querySelector('[data-evolution-status]');
    this.unavailableNode = this.root.querySelector('[data-evolution-unavailable]');
    this.unavailableLabelNode = this.root.querySelector('[data-evolution-unavailable-label]');
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
    this.walkShadow = this.root.querySelector('[data-evolution-walk-shadow]');
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

    const modal = this.root.closest('[data-avatar-modal]');
    modal?.addEventListener('avatar-gallery:open', () => {
      void this.activate();
    });
    modal?.addEventListener('avatar-gallery:close', () => {
      this.active = false;
      this.resetForNextOpen();
    });

    const staticFallbackImage = this.staticFallbackImage;
    if (staticFallbackImage instanceof HTMLImageElement) {
      staticFallbackImage.addEventListener('load', () => {
        const stageIndex = Number(staticFallbackImage.dataset.evolutionFallbackIndex);
        if (stageIndex === this.index && !this.svgStages[stageIndex]) this.hideUnavailable();
      });
      staticFallbackImage.addEventListener('error', () => {
        const stageIndex = Number(staticFallbackImage.dataset.evolutionFallbackIndex);
        if (stageIndex !== this.index || this.svgStages[stageIndex]) return;
        this.showUnavailable(stageIndex);
        this.render(false);
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopForInactivity();
    });

    const handleMotionChange = () => {
      if (this.reducedMotionQuery.matches) {
        this.stopForInactivity();
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
        if (this.loading) this.setLoadingStatus(this.translate('avatar.evolution.loading'));
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
      if (!this.reducedMotionQuery.matches && !this.fallbackMode) {
        this.enterStableStage(0, false);
        this.startAutoplay();
      } else {
        this.showStableStage(0);
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
          svg.dataset.walkPose = 'rest';
          svg.classList.add('absolute', 'inset-0', 'h-full', 'w-full', 'object-contain', 'p-1', 'sm:p-3');
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
    this.setLoadingStatus('');
    this.showStableStage(this.index);
    this.updateNotice();
    this.render(false);
  }

  /** @param {string} value */
  setLoadingStatus(value) {
    if (this.statusNode) this.statusNode.textContent = value;
    if (this.loadingLabelNode) this.loadingLabelNode.textContent = value;
  }

  updateNotice() {
    if (!(this.noticeNode instanceof HTMLElement)) return;
    let message = '';
    if (this.fallbackMode) {
      message = this.translate('avatar.evolution.loadError');
    } else if (this.poseFailure) {
      message = this.translate('avatar.evolution.poseLoadError');
    } else if (this.reducedMotionQuery.matches) {
      message = this.translate('avatar.evolution.motionReduced');
    }
    this.noticeNode.textContent = message;
    this.noticeNode.hidden = !message;
  }

  startAutoplay() {
    if (!this.active || this.reducedMotionQuery.matches || this.fallbackMode || this.loading) return;
    if (
      this.index >= this.stages.length - 1 &&
      !this.motion &&
      (this.completed || this.visitWalkState === 'complete' || this.visitWalkState === 'skipped')
    ) {
      this.enterStableStage(0, true);
    }
    this.autoplay = true;
    this.resumeAutoplay = true;
    this.paused = false;
    this.completed = false;

    if (this.motion) {
      this.resumeMotion();
    } else if (this.holdRemaining > 0) {
      this.resumeHold();
    } else if (this.visitWalkState === 'idle') {
      this.beginWalkVisit(this.index, this.visitId);
    } else if (this.visitWalkState === 'complete' || this.visitWalkState === 'skipped') {
      this.scheduleAdvance();
    }
    this.render(false);
  }

  pausePlayback() {
    this.resumeAutoplay = this.autoplay;
    this.autoplay = false;
    this.pauseHold();
    if (this.motion) {
      this.paused = true;
      this.motionAnimations(this.motion).forEach((animation) => animation.pause());
      if (this.motion.type === 'walk' && this.motion.frameId) {
        window.cancelAnimationFrame(this.motion.frameId);
        this.motion.frameId = 0;
      }
    } else if (this.visitWalkState === 'loading' || this.holdRemaining > 0) {
      this.paused = true;
    }
    this.render(false);
  }

  togglePlayback() {
    if (this.reducedMotionQuery.matches || this.fallbackMode || this.loading) return;
    const isRunning = !this.paused && (
      this.autoplay ||
      Boolean(this.motion) ||
      Boolean(this.holdId) ||
      this.visitWalkState === 'loading'
    );
    if (isRunning) {
      this.pausePlayback();
      return;
    }
    if (this.paused && (
      this.motion ||
      this.holdRemaining > 0 ||
      this.visitWalkState === 'idle' ||
      this.visitWalkState === 'loading'
    )) {
      this.resumePlayback();
      return;
    }
    this.startAutoplay();
  }

  resumePlayback() {
    this.autoplay = this.resumeAutoplay;
    this.paused = false;
    if (this.motion) {
      this.resumeMotion();
    } else if (this.holdRemaining > 0) {
      this.resumeHold();
    } else if (this.visitWalkState === 'idle') {
      this.beginWalkVisit(this.index, this.visitId);
    }
    this.render(false);
  }

  restart() {
    this.clearHold();
    this.cancelMotion();
    this.visitId += 1;
    this.visitWalkState = 'idle';
    this.paused = false;
    this.resumeAutoplay = false;
    if (this.reducedMotionQuery.matches || this.fallbackMode) {
      this.autoplay = false;
      this.showStableStage(0);
      this.completed = false;
      this.render(true);
      return;
    }
    this.enterStableStage(0, true);
    this.startAutoplay();
  }

  /** @param {number} delta */
  navigate(delta) {
    if (this.motion?.type === 'transition' || this.loading) return;
    const target = Math.max(0, Math.min(this.stages.length - 1, this.index + delta));
    if (target === this.index) return;
    this.autoplay = false;
    this.clearHold();
    this.cancelMotion();
    this.visitId += 1;
    this.visitWalkState = 'idle';
    this.paused = false;
    this.resumeAutoplay = false;
    this.completed = false;

    if (this.reducedMotionQuery.matches || this.fallbackMode) {
      this.showStableStage(target);
      this.completed = target === this.stages.length - 1;
      this.render(true);
      return;
    }
    this.startTransition(target, false);
  }

  /** @param {number} [duration] */
  scheduleAdvance(duration = POST_WALK_HOLD_DURATION) {
    this.clearHold();
    this.holdRemaining = duration;
    this.resumeHold();
  }

  resumeHold() {
    if (
      !this.autoplay ||
      !this.active ||
      this.holdId ||
      this.holdRemaining <= 0 ||
      this.index >= this.stages.length - 1
    ) return;
    const duration = this.holdRemaining;
    this.holdDeadline = performance.now() + duration;
    this.holdId = window.setTimeout(() => {
      this.holdId = 0;
      this.holdDeadline = 0;
      this.holdRemaining = 0;
      if (this.autoplay && this.active) this.startTransition(this.index + 1, true);
    }, duration);
  }

  pauseHold() {
    if (!this.holdId) return;
    window.clearTimeout(this.holdId);
    this.holdId = 0;
    this.holdRemaining = Math.max(0, this.holdDeadline - performance.now());
    this.holdDeadline = 0;
  }

  clearHold() {
    if (this.holdId) window.clearTimeout(this.holdId);
    this.holdId = 0;
    this.holdDeadline = 0;
    this.holdRemaining = 0;
  }

  /**
   * @param {number} targetIndex
   * @param {boolean} continueAutoplay
   */
  startTransition(targetIndex, continueAutoplay) {
    this.clearHold();
    this.cancelMotion();
    this.visitId += 1;
    this.visitWalkState = 'idle';
    this.showWalkPose(this.index, 'rest');
    this.showWalkPose(targetIndex, 'rest');

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

    this.paused = false;
    const animations = this.animateTransition(currentLayer, targetLayer, direction);
    const transition = { type: /** @type {const} */ ('transition'), targetIndex, continueAutoplay, animations };
    this.motion = transition;
    void this.ensureWalkPoses(targetIndex);
    const completion = animations.map((animation) => animation.finished.catch(() => undefined));
    void Promise.all(completion).then(() => {
      if (this.motion === transition) this.finishTransition(transition);
    });
    this.render(false);
  }

  resumeMotion() {
    const motion = this.motion;
    if (!motion) return;
    this.paused = false;
    this.motionAnimations(motion).forEach((animation) => animation.play());
    if (motion.type === 'walk') this.syncWalkFrame(motion);
    this.render(false);
  }

  /** @param {({ type: 'transition' } & TransitionState)} transition */
  finishTransition(transition) {
    if (this.motion !== transition) return;
    const shouldContinue = transition.continueAutoplay && this.autoplay;
    const targetIndex = transition.targetIndex;
    transition.animations.forEach((animation) => animation.cancel());
    this.motion = null;
    this.paused = false;
    this.hideEffects();
    this.autoplay = shouldContinue;
    this.enterStableStage(targetIndex, true);
    this.render(false);
  }

  cancelMotion() {
    const motion = this.motion;
    if (motion?.type === 'walk' && motion.frameId) window.cancelAnimationFrame(motion.frameId);
    if (motion) this.motionAnimations(motion).forEach((animation) => animation.cancel());
    if (motion?.type === 'walk') {
      this.showWalkPose(motion.stageIndex, 'rest');
      const layer = this.stageLayers[motion.stageIndex];
      if (layer) this.resetLayerStyles(layer);
    }
    this.motion = null;
    this.paused = false;
    this.hideEffects();
    this.hideWalkShadow();
    this.stageLayers.forEach((layer, layerIndex) => {
      if (!layer) return;
      this.resetLayerStyles(layer);
      layer.hidden = layerIndex !== this.index;
    });
  }

  /** @param {MotionState} motion */
  motionAnimations(motion) {
    if (motion.type === 'transition') return motion.animations;
    return motion.shadowAnimation ? [motion.avatarAnimation, motion.shadowAnimation] : [motion.avatarAnimation];
  }

  /**
   * @param {number} index
   * @param {boolean} announce
   */
  enterStableStage(index, announce) {
    this.clearHold();
    this.showStableStage(index);
    this.visitId += 1;
    this.visitWalkState = 'idle';
    this.completed = false;
    this.render(announce);

    if (!this.active || this.reducedMotionQuery.matches || this.fallbackMode) {
      this.completed = index === this.stages.length - 1;
      return;
    }
    this.beginWalkVisit(index, this.visitId);
  }

  /**
   * @param {number} index
   * @param {number} visitId
   */
  beginWalkVisit(index, visitId) {
    if (
      this.motion ||
      !this.active ||
      this.reducedMotionQuery.matches ||
      this.fallbackMode ||
      index !== this.index ||
      visitId !== this.visitId
    ) return;

    this.visitWalkState = 'loading';
    void this.ensureWalkPoses(index).then((poses) => {
      if (
        index !== this.index ||
        visitId !== this.visitId ||
        !this.active ||
        this.reducedMotionQuery.matches ||
        this.fallbackMode
      ) return;

      if (!poses) {
        this.finishWalklessVisit(index, visitId);
        return;
      }
      if (this.paused) {
        this.visitWalkState = 'idle';
        this.render(false);
        return;
      }
      this.startWalk(index, visitId);
    });
  }

  /** @param {number} index */
  ensureWalkPoses(index) {
    const cached = this.walkPoseLayers[index];
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = this.walkPosePromises[index];
    if (pending) return pending;

    const stage = this.stages[index];
    const layer = this.stageLayers[index];
    const sources = stage?.walkPoses;
    if (!sources || !layer || this.reducedMotionQuery.matches) {
      this.walkPoseLayers[index] = null;
      return Promise.resolve(null);
    }

    const promise = Promise.all([
      this.createWalkPoseImage(sources.contactA, 'contact-a'),
      this.createWalkPoseImage(sources.passing, 'passing'),
      this.createWalkPoseImage(sources.contactB, 'contact-b'),
    ])
      .then(([contactA, passing, contactB]) => {
        const poses = { contactA, passing, contactB };
        layer.append(contactA, passing, contactB);
        this.walkPoseLayers[index] = poses;
        return poses;
      })
      .catch((error) => {
        console.warn('[avatar-evolution] Walk poses failed to load; keeping the rest pose', {
          stage: stage.id,
          error,
        });
        this.poseFailure = true;
        this.updateNotice();
        this.walkPoseLayers[index] = null;
        return null;
      })
      .finally(() => {
        this.walkPosePromises[index] = undefined;
      });
    this.walkPosePromises[index] = promise;
    return promise;
  }

  /**
   * @param {string} source
   * @param {Exclude<WalkPose, 'rest'>} pose
   */
  async createWalkPoseImage(source, pose) {
    const image = new Image();
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.dataset.walkPose = pose;
    image.decoding = 'async';
    image.draggable = false;
    image.hidden = true;
    image.className = 'absolute inset-0 h-full w-full object-contain p-1 sm:p-3';

    await new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', () => reject(new Error(`Unable to load ${pose}`)), { once: true });
      image.src = source;
    });
    if (typeof image.decode === 'function') {
      try {
        await image.decode();
      } catch (error) {
        if (!image.complete || image.naturalWidth === 0) throw error;
      }
    }
    return image;
  }

  /**
   * @param {number} index
   * @param {WalkPose} pose
   */
  showWalkPose(index, pose) {
    const svg = this.svgStages[index];
    const poses = this.walkPoseLayers[index];
    const selected = pose === 'contact-a'
      ? poses?.contactA
      : pose === 'passing'
        ? poses?.passing
        : pose === 'contact-b'
          ? poses?.contactB
          : null;

    if (svg) svg.style.display = selected ? 'none' : '';
    if (!poses) return;
    poses.contactA.hidden = selected !== poses.contactA;
    poses.passing.hidden = selected !== poses.passing;
    poses.contactB.hidden = selected !== poses.contactB;
  }

  /**
   * @param {number} index
   * @param {number} visitId
   */
  startWalk(index, visitId) {
    const layer = this.stageLayers[index];
    if (!layer || this.motion || index !== this.index || visitId !== this.visitId) return;

    this.showWalkPose(index, 'rest');
    layer.hidden = false;
    const avatarAnimation = layer.animate(
      [
        { transform: 'translate3d(0,0,0) rotate(0deg)', offset: 0 },
        { transform: 'translate3d(.4%,-.4%,0) rotate(-.35deg)', offset: 0.12 },
        { transform: 'translate3d(1.2%,.8%,0) rotate(.25deg)', offset: 0.34 },
        { transform: 'translate3d(2%,-.5%,0) rotate(-.3deg)', offset: 0.58 },
        { transform: 'translate3d(1.2%,0,0) rotate(.2deg)', offset: 0.82 },
        { transform: 'translate3d(0,0,0) rotate(0deg)', offset: 1 },
      ],
      { duration: WALK_DURATION, easing: 'linear', fill: 'both' },
    );

    let shadowAnimation = null;
    if (this.walkShadow instanceof HTMLElement) {
      this.walkShadow.hidden = false;
      shadowAnimation = this.walkShadow.animate(
        [
          { opacity: 0, transform: 'translateX(-50%) scale(.88)', offset: 0 },
          { opacity: 0.2, transform: 'translateX(-50%) scale(.92)', offset: 0.12 },
          { opacity: 0.27, transform: 'translateX(-50%) scale(1.05)', offset: 0.34 },
          { opacity: 0.19, transform: 'translateX(-50%) scale(.9)', offset: 0.58 },
          { opacity: 0.24, transform: 'translateX(-50%) scale(1.02)', offset: 0.82 },
          { opacity: 0, transform: 'translateX(-50%) scale(.88)', offset: 1 },
        ],
        { duration: WALK_DURATION, easing: 'linear', fill: 'both' },
      );
    }

    const walk = {
      type: /** @type {const} */ ('walk'),
      stageIndex: index,
      visitId,
      avatarAnimation,
      shadowAnimation,
      frameId: 0,
    };
    this.motion = walk;
    this.visitWalkState = 'walking';
    this.paused = false;
    this.syncWalkFrame(walk);
    void avatarAnimation.finished.then(() => {
      if (this.motion === walk) this.finishWalk(walk);
    }).catch(() => undefined);
    this.render(false);
  }

  /** @param {WalkState} walk */
  syncWalkFrame(walk) {
    if (this.motion !== walk || this.paused) return;
    const elapsed = Number(walk.avatarAnimation.currentTime ?? 0);
    const progress = Math.max(0, Math.min(1, elapsed / WALK_DURATION));
    const pose = progress < 0.12
      ? 'rest'
      : progress < 0.34
        ? 'contact-a'
        : progress < 0.58
          ? 'passing'
          : progress < 0.82
            ? 'contact-b'
            : 'rest';
    this.showWalkPose(walk.stageIndex, pose);
    walk.frameId = window.requestAnimationFrame(() => this.syncWalkFrame(walk));
  }

  /** @param {WalkState} walk */
  finishWalk(walk) {
    if (this.motion !== walk) return;
    if (walk.frameId) window.cancelAnimationFrame(walk.frameId);
    this.motion = null;
    walk.avatarAnimation.cancel();
    walk.shadowAnimation?.cancel();
    const layer = this.stageLayers[walk.stageIndex];
    if (layer) this.resetLayerStyles(layer);
    this.showWalkPose(walk.stageIndex, 'rest');
    this.hideWalkShadow();
    this.visitWalkState = 'complete';
    this.paused = false;
    this.holdRemaining = POST_WALK_HOLD_DURATION;

    if (walk.stageIndex >= this.stages.length - 1) {
      this.autoplay = false;
      this.completed = true;
      this.holdRemaining = 0;
    } else if (this.autoplay && this.active) {
      this.scheduleAdvance();
    }
    this.render(false);
  }

  /**
   * @param {number} index
   * @param {number} visitId
   */
  finishWalklessVisit(index, visitId) {
    if (index !== this.index || visitId !== this.visitId) return;
    this.visitWalkState = 'skipped';
    this.holdRemaining = POST_WALK_HOLD_DURATION;
    if (index >= this.stages.length - 1) {
      this.autoplay = false;
      this.completed = true;
      this.holdRemaining = 0;
    } else if (this.autoplay && this.active) {
      this.scheduleAdvance();
    }
    this.render(false);
  }

  hideWalkShadow() {
    if (!(this.walkShadow instanceof HTMLElement)) return;
    this.walkShadow.hidden = true;
    this.walkShadow.style.removeProperty('opacity');
    this.walkShadow.style.removeProperty('transform');
  }

  stopForInactivity() {
    this.autoplay = false;
    this.clearHold();
    this.cancelMotion();
    this.visitId += 1;
    this.visitWalkState = 'idle';
    this.paused = false;
    this.resumeAutoplay = false;
    if (this.loaded) this.showStableStage(this.index);
    this.render(false);
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
    this.stageLayers.forEach((layer, layerIndex) => {
      if (!layer) return;
      this.resetLayerStyles(layer);
      this.showWalkPose(layerIndex, 'rest');
      layer.hidden = layerIndex !== index;
    });
    this.hideEffects();
    this.hideWalkShadow();
    this.hideUnavailable();

    const activeSvg = this.svgStages[index];
    if (this.staticFallbackImage instanceof HTMLImageElement) {
      const shouldShowFallback = !activeSvg;
      this.staticFallbackImage.hidden = !shouldShowFallback;
      this.staticFallbackImage.classList.toggle('hidden', !shouldShowFallback);
      if (shouldShowFallback) {
        this.staticFallbackImage.dataset.evolutionFallbackIndex = String(index);
        this.staticFallbackImage.src = this.stages[index].vectorImage;
        if (this.staticFallbackImage.complete && this.staticFallbackImage.naturalWidth === 0) {
          this.showUnavailable(index);
        }
      }
    }
  }

  hideUnavailable() {
    this.unavailableStageIndex = -1;
    if (!(this.unavailableNode instanceof HTMLElement)) return;
    this.unavailableNode.hidden = true;
    this.unavailableNode.classList.add('hidden');
    this.unavailableNode.classList.remove('flex');
  }

  /** @param {number} index */
  showUnavailable(index) {
    this.unavailableStageIndex = index;
    if (this.staticFallbackImage instanceof HTMLImageElement) {
      this.staticFallbackImage.hidden = true;
      this.staticFallbackImage.classList.add('hidden');
    }
    if (this.unavailableLabelNode) {
      this.unavailableLabelNode.textContent = this.translate('avatar.evolution.stageUnavailable')
        .replace('{version}', this.stages[index]?.version ?? '');
    }
    if (this.unavailableNode instanceof HTMLElement) {
      this.unavailableNode.hidden = false;
      this.unavailableNode.classList.remove('hidden');
      this.unavailableNode.classList.add('flex');
    }
  }

  resetForNextOpen() {
    this.clearHold();
    this.cancelMotion();
    this.autoplay = false;
    this.activatedThisOpen = false;
    this.completed = false;
    this.paused = false;
    this.resumeAutoplay = false;
    this.visitId += 1;
    this.visitWalkState = 'idle';
    if (this.announcementNode) this.announcementNode.textContent = '';
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
      const canvasLabel = this.unavailableStageIndex === this.index
        ? this.translate('avatar.evolution.stageUnavailable').replace('{version}', stage.version)
        : `${stage.version}: ${title}. ${description}`;
      this.canvas.setAttribute('aria-label', canvasLabel);
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

    const showPause = !this.paused && (
      this.autoplay ||
      Boolean(this.motion) ||
      Boolean(this.holdId) ||
      this.visitWalkState === 'loading'
    );
    if (this.playLabel) {
      this.playLabel.textContent = this.translate(showPause ? 'avatar.evolution.pause' : 'avatar.evolution.play');
    }
    if (this.playIcon) this.playIcon.textContent = showPause ? 'Ⅱ' : '▶';
    if (this.playButton) {
      const label = this.translate(showPause ? 'avatar.evolution.pause' : 'avatar.evolution.play');
      this.playButton.setAttribute('aria-label', label);
      this.playButton.disabled = this.loading || this.fallbackMode || this.reducedMotionQuery.matches;
    }
    const transitionActive = this.motion?.type === 'transition';
    if (this.previousButton) this.previousButton.disabled = this.loading || transitionActive || this.index === 0;
    if (this.nextButton) this.nextButton.disabled = this.loading || transitionActive || this.index === this.stages.length - 1;
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
      'avatar.evolution.loadError': this.locale === 'es' ? 'Algunas etapas vectoriales no pudieron animarse. Las etapas SVG disponibles se pueden seguir explorando.' : 'Some vector stages could not animate. Available SVG stages remain browsable.',
      'avatar.evolution.poseLoadError': this.locale === 'es' ? 'Una pose de caminata no se pudo cargar. El SVG canónico sigue disponible.' : 'A walking pose could not load. The canonical SVG remains available.',
      'avatar.evolution.stageUnavailable': this.locale === 'es' ? 'El vector de {version} no está disponible.' : 'The {version} vector is unavailable.',
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
