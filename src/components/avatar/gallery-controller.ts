type AvatarGalleryEntry = {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  titleEs: string;
  descriptionEs: string;
  finalImage: string;
};

type AvatarGalleryConfig = {
  animation?: 'fade' | 'morph';
};

const AUTOPLAY_INTERVAL = 3000;

class MinimalGalleryController {
  private root: HTMLElement;
  private entries: AvatarGalleryEntry[];
  private config: AvatarGalleryConfig;
  private index = 0;
  private autoplayId: number | null = null;
  private paused = false;
  private locale: 'en' | 'es' = 'en';
  private localeObserver?: MutationObserver;

  private image?: HTMLImageElement | null;
  private titleNode?: HTMLElement | null;
  private metaNode?: HTMLElement | null;
  private descriptionNode?: HTMLElement | null;
  private prevButton?: HTMLButtonElement | null;
  private nextButton?: HTMLButtonElement | null;
  private hoverZone?: HTMLElement | null;
  private headingNode?: HTMLElement | null;
  private prevLabelNode?: HTMLElement | null;
  private nextLabelNode?: HTMLElement | null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.entries = this.parseEntries();
    this.config = this.parseConfig();
    if (!this.entries.length) return;
    this.locale = this.detectLocale();
    this.cacheElements();
    this.bindEvents();
    this.render();
    this.startAutoplay();
    this.observeLocaleChanges();
  }

  private parseEntries(): AvatarGalleryEntry[] {
    const dataNode = this.root.querySelector<HTMLScriptElement>(
      'script[data-avatar-gallery-data]',
    );
    if (!dataNode?.textContent) return [];
    try {
      return JSON.parse(dataNode.textContent) as AvatarGalleryEntry[];
    } catch (error) {
      console.error('[avatar-gallery] Unable to parse entries', error);
      return [];
    }
  }

  private parseConfig(): AvatarGalleryConfig {
    const raw = this.root.getAttribute('data-gallery-config');
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private cacheElements() {
    this.image = this.root.querySelector<HTMLImageElement>('[data-gallery-final]');
    this.titleNode = this.root.querySelector<HTMLElement>('[data-gallery-title]');
    this.metaNode = this.root.querySelector<HTMLElement>('[data-gallery-meta]');
    this.descriptionNode = this.root.querySelector<HTMLElement>(
      '[data-gallery-description]',
    );
    this.prevButton = this.root.querySelector<HTMLButtonElement>(
      '[data-gallery-action="prev"]',
    );
    this.nextButton = this.root.querySelector<HTMLButtonElement>(
      '[data-gallery-action="next"]',
    );
    this.hoverZone = this.root.querySelector<HTMLElement>('[data-gallery-hover-zone]');
    this.headingNode = this.root.querySelector<HTMLElement>('[data-gallery-heading]');
    this.prevLabelNode = this.root.querySelector<HTMLElement>('[data-gallery-prev-label]');
    this.nextLabelNode = this.root.querySelector<HTMLElement>('[data-gallery-next-label]');
  }

  private bindEvents() {
    this.prevButton?.addEventListener('click', () => this.showPrevious());
    this.nextButton?.addEventListener('click', () => this.showNext());

    const pause = () => this.setPaused(true);
    const resume = () => this.setPaused(false);

    this.root.addEventListener('focusin', pause);
    this.root.addEventListener('focusout', resume);
    this.hoverZone?.addEventListener('pointerenter', pause);
    this.hoverZone?.addEventListener('pointerleave', resume);
  }

  private detectLocale(): 'en' | 'es' {
    const langAttr = document.documentElement.lang?.toLowerCase() ?? 'en';
    return langAttr.startsWith('es') ? 'es' : 'en';
  }

  private observeLocaleChanges() {
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

  private setPaused(nextPaused: boolean) {
    if (this.paused === nextPaused) return;
    this.paused = nextPaused;
    if (this.paused) {
      this.stopAutoplay();
    } else {
      this.startAutoplay();
    }
  }

  private startAutoplay() {
    if (this.autoplayId || this.paused) return;
    this.autoplayId = window.setInterval(() => this.showNext(), AUTOPLAY_INTERVAL);
  }

  private stopAutoplay() {
    if (this.autoplayId) {
      window.clearInterval(this.autoplayId);
      this.autoplayId = null;
    }
  }

  private showNext() {
    this.index = (this.index + 1) % this.entries.length;
    this.render();
  }

  private showPrevious() {
    this.index = (this.index - 1 + this.entries.length) % this.entries.length;
    this.render();
  }

  private render() {
    const entry = this.entries[this.index];
    if (!entry || !this.image) return;
    const { title, description } = this.getLocalizedCopy(entry);
    this.animateImage(entry.finalImage, title);
    if (this.titleNode) this.titleNode.textContent = title;
    if (this.metaNode) {
      this.metaNode.textContent = `${entry.version} • ${entry.date}`;
    }
    if (this.descriptionNode) {
      this.descriptionNode.textContent = description;
    }
    this.applyChromeCopy();
  }

  private getLocalizedCopy(entry: AvatarGalleryEntry) {
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

  private applyChromeCopy() {
    if (this.headingNode) {
      const heading =
        this.locale === 'es'
          ? this.headingNode.getAttribute('data-heading-es')
          : this.headingNode.getAttribute('data-heading-en');
      if (heading) {
        this.headingNode.textContent = heading;
      }
    }
    if (this.prevLabelNode) {
      const prev =
        this.locale === 'es'
          ? this.prevLabelNode.getAttribute('data-label-es')
          : this.prevLabelNode.getAttribute('data-label-en');
      if (prev) {
        this.prevLabelNode.textContent = prev;
      }
    }
    if (this.nextLabelNode) {
      const next =
        this.locale === 'es'
          ? this.nextLabelNode.getAttribute('data-label-es')
          : this.nextLabelNode.getAttribute('data-label-en');
      if (next) {
        this.nextLabelNode.textContent = next;
      }
    }
    const prevAria =
      this.locale === 'es'
        ? this.prevButton?.getAttribute('data-prev-aria-es')
        : this.prevButton?.getAttribute('data-prev-aria-en');
    if (prevAria && this.prevButton) {
      this.prevButton.setAttribute('aria-label', prevAria);
    }
    const nextAria =
      this.locale === 'es'
        ? this.nextButton?.getAttribute('data-next-aria-es')
        : this.nextButton?.getAttribute('data-next-aria-en');
    if (nextAria && this.nextButton) {
      this.nextButton.setAttribute('aria-label', nextAria);
    }
  }

  private animateImage(nextSrc: string, alt: string) {
    if (!this.image) return;
    if (this.image.src !== nextSrc) {
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
      this.image.animate(keyframes, { duration: 250 });
      this.image.src = nextSrc;
    }
    this.image.alt = alt;
  }
}

const init = () => {
  document
    .querySelectorAll<HTMLElement>('[data-avatar-gallery]')
    .forEach((node) => new MinimalGalleryController(node));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
