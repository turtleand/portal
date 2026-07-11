// @ts-check

const ACTIVE_CLASSES = ['border-accent/50', 'bg-accent/15', 'text-offWhite'];
const INACTIVE_CLASSES = ['border-transparent', 'text-offWhite/60'];

class AvatarGalleryTabsController {
  /** @param {HTMLElement} modal */
  constructor(modal) {
    this.modal = modal;
    /** @type {HTMLButtonElement[]} */
    this.tabs = Array.from(modal.querySelectorAll('[data-gallery-tab]')).filter(
      (node) => node instanceof HTMLButtonElement,
    );
    /** @type {HTMLElement[]} */
    this.panels = Array.from(modal.querySelectorAll('[data-gallery-panel]')).filter(
      (node) => node instanceof HTMLElement,
    );

    if (!this.tabs.length || !this.panels.length) return;
    this.bindEvents();
    this.select('archive', { reason: 'initial' });
  }

  bindEvents() {
    this.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.galleryTab;
        if (view) this.select(view, { focus: true, reason: 'tab' });
      });
      tab.addEventListener('keydown', (event) => this.handleTabKeydown(event, tab));
    });

    this.modal.addEventListener('avatar-gallery:open', () => {
      this.select('archive', { reason: 'modal-open' });
    });
  }

  /**
   * @param {KeyboardEvent} event
   * @param {HTMLButtonElement} currentTab
   */
  handleTabKeydown(event, currentTab) {
    const currentIndex = this.tabs.indexOf(currentTab);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % this.tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = this.tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = this.tabs[nextIndex];
    const view = nextTab?.dataset.galleryTab;
    if (nextTab && view) this.select(view, { focus: true, reason: 'keyboard' });
  }

  /**
   * @param {string} view
   * @param {{ focus?: boolean; reason?: string }} [options]
   */
  select(view, options = {}) {
    this.tabs.forEach((tab) => {
      const isActive = tab.dataset.galleryTab === view;
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
      tab.classList.remove(...(isActive ? INACTIVE_CLASSES : ACTIVE_CLASSES));
      tab.classList.add(...(isActive ? ACTIVE_CLASSES : INACTIVE_CLASSES));
      if (isActive && options.focus) tab.focus();
    });

    this.panels.forEach((panel) => {
      const isActive = panel.dataset.galleryPanel === view;
      panel.hidden = !isActive;
      panel.inert = !isActive;
      const gallery = panel.querySelector('[data-avatar-gallery], [data-avatar-evolution]');
      gallery?.dispatchEvent(
        new CustomEvent(isActive ? 'avatar-gallery:activate' : 'avatar-gallery:deactivate', {
          detail: { reason: options.reason ?? 'tab' },
        }),
      );
    });
  }
}

const initGalleryTabs = () => {
  const modal = document.querySelector('[data-avatar-modal]');
  if (modal instanceof HTMLElement) new AvatarGalleryTabsController(modal);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGalleryTabs, { once: true });
} else {
  initGalleryTabs();
}
