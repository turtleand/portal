// @ts-check

/**
 * @typedef {Object} AvatarGalleryEntry
 * @property {string} id
 * @property {string} version
 * @property {string} date
 * @property {string} title
 * @property {string} description
 * @property {string} titleEs
 * @property {string} descriptionEs
 * @property {string} finalImage
 */

/**
 * @typedef {Object} AvatarGalleryConfig
 * @property {'fade' | 'morph'} [animation]
 */

const AUTOPLAY_INTERVAL = 3000;

class MinimalGalleryController {
  /**
   * @param {HTMLElement} root
   */
  constructor(root) {
    /** @type {HTMLElement} */
    this.root = root;
    /** @type {AvatarGalleryEntry[]} */
    this.entries = this.parseEntries();
    /** @type {AvatarGalleryConfig} */
    this.config = this.parseConfig();
    this.index = 0;
    /** @type {number | null} */
    this.autoplayId = null;
    this.paused = false;
    /** @type {'en' | 'es'} */
    this.locale = this.detectLocale();
    /** @type {MutationObserver | undefined} */
    this.localeObserver = undefined;

    /** @type {HTMLImageElement[]} */
    this.images = [];
    /** @type {HTMLElement | null} */
    this.titleNode = null;
    /** @type {HTMLElement | null} */
    this.metaNode = null;
    /** @type {HTMLElement | null} */
    this.descriptionNode = null;
    /** @type {HTMLButtonElement | null} */
    this.prevButton = null;
    /** @type {HTMLButtonElement | null} */
    this.nextButton = null;
    /** @type {HTMLElement | null} */
    this.hoverZone = null;
    /** @type {HTMLElement | null} */
    this.headingNode = null;
    /** @type {HTMLElement | null} */
    this.prevLabelNode = null;
    /** @type {HTMLElement | null} */
    this.nextLabelNode = null;
    /** @type {Animation | null} */
    this.currentAnimation = null;

    if (!this.entries.length) {
      return;
    }
    this.cacheElements();
    this.preloadAllImages();
    this.bindEvents();
    this.render();
    if (this.isInsideHiddenModal()) {
      this.paused = true;
    } else {
      this.startAutoplay();
    }
    this.observeLocaleChanges();
  }

  /**
   * @returns {AvatarGalleryEntry[]}
   */
  parseEntries() {
    /** @type {HTMLScriptElement | null} */
    const dataNode = this.root.querySelector('script[data-avatar-gallery-data]');
    if (!dataNode?.textContent) return [];
    try {
      const parsed = JSON.parse(dataNode.textContent);
      return Array.isArray(parsed)
        ? parsed.sort((a, b) => a.date.localeCompare(b.date))
        : [];
    } catch (error) {
      console.error('[avatar-gallery] Unable to parse entries', error);
      return [];
    }
  }

  /**
   * @returns {AvatarGalleryConfig}
   */
  parseConfig() {
    const raw = this.root.getAttribute('data-gallery-config');
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  preloadAllImages() {
    // Images are server-rendered in the stage so their URLs stay out of the
    // JSON-driven client renderer and are requested by the browser directly.
  }

  cacheElements() {
    this.images = Array.from(this.root.querySelectorAll('[data-gallery-final]')).filter(
      (node) => node instanceof HTMLImageElement,
    );
    this.titleNode = this.root.querySelector('[data-gallery-title]');
    this.metaNode = this.root.querySelector('[data-gallery-meta]');
    this.descriptionNode = this.root.querySelector('[data-gallery-description]');
    this.prevButton = this.root.querySelector('[data-gallery-action="prev"]');
    this.nextButton = this.root.querySelector('[data-gallery-action="next"]');
    this.hoverZone = this.root.querySelector('[data-gallery-hover-zone]');
    this.headingNode = this.root.querySelector('[data-gallery-heading]');
    this.prevLabelNode = this.root.querySelector('[data-gallery-prev-label]');
    this.nextLabelNode = this.root.querySelector('[data-gallery-next-label]');
  }

  bindEvents() {
    this.prevButton?.addEventListener('click', () => this.showPrevious());
    this.nextButton?.addEventListener('click', () => this.showNext());

    const pause = () => this.setPaused(true);
    const resume = () => this.setPaused(false);

    this.root.addEventListener('focusin', pause);
    this.root.addEventListener('focusout', resume);
    this.hoverZone?.addEventListener('pointerenter', pause);
    this.hoverZone?.addEventListener('pointerleave', resume);

    const modal = this.getContainingModal();
    modal?.addEventListener('avatar-gallery:open', () => {
      this.index = 0;
      this.render();
      this.setPaused(false);
    });
    modal?.addEventListener('avatar-gallery:close', pause);
  }

  /**
   * @returns {HTMLElement | null}
   */
  getContainingModal() {
    const modal = this.root.closest('[data-avatar-modal]');
    return modal instanceof HTMLElement ? modal : null;
  }

  isInsideHiddenModal() {
    const modal = this.getContainingModal();
    return modal?.getAttribute('aria-hidden') === 'true';
  }

  /**
   * @returns {'en' | 'es'}
   */
  detectLocale() {
    const langAttr = document.documentElement.lang?.toLowerCase() ?? 'en';
    return langAttr.startsWith('es') ? 'es' : 'en';
  }

  observeLocaleChanges() {
    this.localeObserver = new MutationObserver(() => {
      const nextLocale = this.detectLocale();
      if (nextLocale !== this.locale) {
        this.locale = nextLocale;
        this.render();
      }
    });
    this.localeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });
  }

  /**
   * @param {boolean} nextPaused
   */
  setPaused(nextPaused) {
    if (this.paused === nextPaused) return;
    this.paused = nextPaused;
    if (this.paused) {
      this.stopAutoplay();
    } else {
      this.startAutoplay();
    }
  }

  startAutoplay() {
    if (this.autoplayId || this.paused) return;
    this.autoplayId = window.setInterval(() => this.showNext(), AUTOPLAY_INTERVAL);
  }

  stopAutoplay() {
    if (this.autoplayId) {
      window.clearInterval(this.autoplayId);
      this.autoplayId = null;
    }
  }

  showNext() {
    this.index = (this.index + 1) % this.entries.length;
    this.render();
  }

  showPrevious() {
    this.index = (this.index - 1 + this.entries.length) % this.entries.length;
    this.render();
  }

  render() {
    const entry = this.entries[this.index];
    if (!entry || !this.images.length) return;
    const { title, description } = this.getLocalizedCopy(entry);
    this.animateImage(this.index, title);
    if (this.titleNode) this.titleNode.textContent = title;
    if (this.metaNode) {
      this.metaNode.textContent = `${entry.version} • ${entry.date}`;
    }
    if (this.descriptionNode) {
      this.descriptionNode.textContent = description;
    }
    this.applyChromeCopy();
  }

  /**
   * @param {AvatarGalleryEntry} entry
   */
  getLocalizedCopy(entry) {
    if (this.locale === 'es') {
      return {
        title: entry.titleEs ?? entry.title,
        description: entry.descriptionEs ?? entry.description,
      };
    }
    return {
      title: entry.title,
      description: entry.description,
    };
  }

  applyChromeCopy() {
    if (this.locale === 'es') {
      if (this.headingNode) this.headingNode.textContent = 'Archivo de Evolución';
      if (this.prevLabelNode) this.prevLabelNode.textContent = 'Anterior';
      if (this.nextLabelNode) this.nextLabelNode.textContent = 'Siguiente';
      if (this.prevButton) this.prevButton.setAttribute('aria-label', 'Avatar anterior');
      if (this.nextButton) this.nextButton.setAttribute('aria-label', 'Siguiente avatar');
      return;
    }

    if (this.headingNode) this.headingNode.textContent = 'Evolution Archive';
    if (this.prevLabelNode) this.prevLabelNode.textContent = 'Prev';
    if (this.nextLabelNode) this.nextLabelNode.textContent = 'Next';
    if (this.prevButton) this.prevButton.setAttribute('aria-label', 'Previous avatar');
    if (this.nextButton) this.nextButton.setAttribute('aria-label', 'Next avatar');
  }

  /**
   * @param {number} nextIndex
   * @param {string} alt
   */
  animateImage(nextIndex, alt) {
    const nextImage = this.images[nextIndex];
    if (!nextImage) return;

    if (this.currentAnimation) {
      this.currentAnimation.cancel();
      this.currentAnimation = null;
    }

    this.images.forEach((image, index) => {
      const isActive = index === nextIndex;
      image.hidden = !isActive;
      image.classList.toggle('hidden', !isActive);
    });

    const keyframes =
      this.config.animation === 'morph'
        ? [
          { opacity: 0.4, filter: 'blur(6px)' },
          { opacity: 1, filter: 'blur(0px)' },
        ]
        : [
          { opacity: 0.2, transform: 'scale(0.96)' },
          { opacity: 1, transform: 'scale(1)' },
        ];
    this.currentAnimation = nextImage.animate(keyframes, {
      duration: 250,
      fill: 'backwards',
    });
    nextImage.alt = alt;
  }
}

let domContentLoadedBound = false;

const runGalleryInit = () => {
  document.querySelectorAll('[data-avatar-gallery]').forEach((node) => {
    new MinimalGalleryController(/** @type {HTMLElement} */ (node));
  });
};

const initOnReady = () => {
  if (document.readyState === 'loading') {
    if (domContentLoadedBound) return;
    domContentLoadedBound = true;
    document.addEventListener('DOMContentLoaded', runGalleryInit, { once: true });
  } else {
    runGalleryInit();
  }
};

initOnReady();

export default initOnReady;
export { initOnReady as initAvatarGallery };
