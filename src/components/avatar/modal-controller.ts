type TriggerButton = HTMLButtonElement | HTMLAnchorElement;

class AvatarGalleryModalController {
  private modal: HTMLElement;
  private overlay: HTMLElement | null;
  private panel: HTMLElement | null;
  private triggers: TriggerButton[] = [];
  private closeButtons: HTMLButtonElement[] = [];
  private active = false;
  private lastTrigger: TriggerButton | null = null;
  private backgroundNodes: HTMLElement[] = [];

  constructor(modal: HTMLElement) {
    this.modal = modal;
    this.overlay = modal.querySelector<HTMLElement>('[data-avatar-modal-overlay]');
    this.panel = modal.querySelector<HTMLElement>('[data-avatar-modal-panel]');
    this.closeButtons = Array.from(
      modal.querySelectorAll<HTMLButtonElement>('[data-avatar-modal-close]'),
    );
    this.collectTriggers();
    this.attachEvents();
  }

  private collectTriggers() {
    this.triggers = Array.from(
      document.querySelectorAll<TriggerButton>('[data-open-avatar-gallery]'),
    );
  }

  private attachEvents() {
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

  private open(trigger: TriggerButton) {
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

  private close() {
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

  private lockScroll() {
    document.body.style.setProperty('overflow', 'hidden');
  }

  private unlockScroll() {
    document.body.style.removeProperty('overflow');
  }

  private disableBackground() {
    this.backgroundNodes = Array.from(document.body.children).filter(
      (node): node is HTMLElement => node !== this.modal && node instanceof HTMLElement,
    );
    this.backgroundNodes.forEach((node) => {
      node.setAttribute('aria-hidden', 'true');
      node.setAttribute('data-avatar-inert', 'true');
      // @ts-expect-error inert is still experimental but supported
      node.inert = true;
    });
  }

  private enableBackground() {
    this.backgroundNodes.forEach((node) => {
      node.removeAttribute('aria-hidden');
      node.removeAttribute('data-avatar-inert');
      // @ts-expect-error inert is still experimental but supported
      node.inert = false;
    });
    this.backgroundNodes = [];
  }

  private trapFocus(event: KeyboardEvent) {
    if (!this.panel) return;
    const focusableSelectors =
      'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(
      this.panel.querySelectorAll<HTMLElement>(focusableSelectors),
    ).filter((node) => !node.hasAttribute('disabled'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement as HTMLElement;

    if (event.shiftKey) {
      if (activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  private updateTriggerState(expanded: boolean) {
    this.triggers.forEach((trigger) => {
      trigger.setAttribute('aria-pressed', String(expanded));
      trigger.setAttribute('aria-expanded', String(expanded));
    });
  }
}

const initModal = () => {
  const modal = document.querySelector<HTMLElement>('[data-avatar-modal]');
  if (!modal) return;
  new AvatarGalleryModalController(modal);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModal, { once: true });
} else {
  initModal();
}
