/**
 * @typedef {HTMLButtonElement | HTMLAnchorElement} TriggerButton
 */

class AvatarGalleryModalController {
  /**
   * @param {HTMLElement} modal
   */
  constructor(modal) {
    this.modal = modal;
    this.overlay = modal.querySelector('[data-avatar-modal-overlay]');
    this.panel = modal.querySelector('[data-avatar-modal-panel]');
    /** @type {TriggerButton[]} */
    this.triggers = [];
    /** @type {HTMLButtonElement[]} */
    this.closeButtons = Array.from(modal.querySelectorAll('[data-avatar-modal-close]'));
    this.active = false;
    /** @type {TriggerButton | null} */
    this.lastTrigger = null;
    /** @type {HTMLElement[]} */
    this.backgroundNodes = [];
    this.collectTriggers();
    this.attachEvents();
  }

  collectTriggers() {
    this.triggers = Array.from(
      document.querySelectorAll('[data-open-avatar-gallery]'),
    );
  }

  attachEvents() {
    this.triggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        this.open(trigger);
      });
    });
    this.closeButtons.forEach((button) => {
      button.addEventListener('click', () => this.close());
    });
    this.overlay?.addEventListener('click', () => this.close());
    document.addEventListener('keydown', (event) => {
      if (!this.active) return;
      if (event.key === 'Escape') {
        this.close();
      } else if (event.key === 'Tab') {
        this.trapFocus(event);
      }
    });
  }

  /**
   * @param {TriggerButton} trigger
   */
  open(trigger) {
    if (this.active) return;
    this.active = true;
    this.lastTrigger = trigger;
    this.modal.classList.remove('hidden');
    this.modal.classList.remove('pointer-events-none');
    this.modal.classList.add('pointer-events-auto');
    this.modal.setAttribute('aria-hidden', 'false');
    document.documentElement.dataset.avatarModalOpen = 'true';
    this.lockScroll();
    this.disableBackground();
    this.updateTriggerState(true);
    window.setTimeout(() => {
      this.panel?.focus();
    }, 0);
  }

  close() {
    if (!this.active) return;
    this.active = false;
    this.modal.classList.add('hidden');
    this.modal.classList.remove('pointer-events-auto');
    this.modal.classList.add('pointer-events-none');
    this.modal.setAttribute('aria-hidden', 'true');
    document.documentElement.dataset.avatarModalOpen = 'false';
    this.unlockScroll();
    this.enableBackground();
    this.updateTriggerState(false);
    this.lastTrigger?.focus();
  }

  lockScroll() {
    document.body.style.setProperty('overflow', 'hidden');
  }

  unlockScroll() {
    document.body.style.removeProperty('overflow');
  }

  disableBackground() {
    this.backgroundNodes = Array.from(document.body.children).filter(
      (node) => node !== this.modal && node instanceof HTMLElement,
    );
    this.backgroundNodes.forEach((node) => {
      node.setAttribute('aria-hidden', 'true');
      node.setAttribute('data-avatar-inert', 'true');
      node.inert = true;
    });
  }

  enableBackground() {
    this.backgroundNodes.forEach((node) => {
      node.removeAttribute('aria-hidden');
      node.removeAttribute('data-avatar-inert');
      node.inert = false;
    });
    this.backgroundNodes = [];
  }

  /**
   * @param {KeyboardEvent} event
   */
  trapFocus(event) {
    if (!this.panel) return;
    const focusableSelectors =
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(this.panel.querySelectorAll(focusableSelectors)).filter(
      (node) => !node.hasAttribute('disabled'),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      if (activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  updateTriggerState(expanded) {
    this.triggers.forEach((trigger) => {
      trigger.setAttribute('aria-pressed', String(expanded));
      trigger.setAttribute('aria-expanded', String(expanded));
    });
  }
}

const initModal = () => {
  const modal = document.querySelector('[data-avatar-modal]');
  if (!(modal instanceof HTMLElement)) return;
  new AvatarGalleryModalController(modal);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModal, { once: true });
} else {
  initModal();
}
