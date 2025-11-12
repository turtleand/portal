// @ts-check
/**
 * @typedef {import('../utils/i18n').Locale} Locale
 * @typedef {Record<string, unknown>} Translations
 * @typedef {{
 *   locale: Locale;
 *   defaultLocale: Locale;
 *   cookieName: string;
 *   translations: Record<Locale, Translations>;
 * }} LocaleBootstrap
 * @typedef {(locale: Locale) => void} Subscriber
 * @typedef {Window & {
 *   __turtleandLocale?: LocaleBootstrap;
 *   turtleandLocaleStore?: {
 *     locale: Locale;
 *     setLocale: (locale: Locale) => void;
 *     subscribe: (fn: Subscriber) => () => void;
 *     t: (key: string) => string;
 *   };
 * }} TurtleWindow
 */

const turtleWindow = /** @type {TurtleWindow} */ (window);
const bootstrap = turtleWindow.__turtleandLocale;

if (!bootstrap) {
  if (import.meta.env.DEV) {
    console.warn('[i18n] Missing bootstrap data. Locale toggle is disabled.');
  }
} else {
  /** @type {Locale[]} */
  const supportedLocales = /** @type {Locale[]} */ (
    Object.keys(bootstrap.translations)
  );
  const defaultLocale = bootstrap.defaultLocale ?? 'en';
  /** @type {Set<Subscriber>} */
  const subscribers = new Set();
  const isSupportedLocale = (value) =>
    typeof value === 'string' && supportedLocales.includes(/** @type {Locale} */ (value));

  /** @returns {Locale | undefined} */
  const readCookieLocale = () => {
    const entries = document.cookie.split(';').map((part) => part.trim());
    const entry = entries.find((cookie) => cookie.startsWith(`${bootstrap.cookieName}=`));
    if (!entry) return undefined;
    const value = entry.split('=')[1];
    if (isSupportedLocale(value)) return /** @type {Locale} */ (value);
    return undefined;
  };

  /** @returns {Locale} */
  const pickInitialLocale = () => {
    const urlLocale = new URL(window.location.href).searchParams.get('lang');
    if (isSupportedLocale(urlLocale)) return /** @type {Locale} */ (urlLocale);
    const cookieLocale = readCookieLocale();
    if (cookieLocale) return cookieLocale;
    return bootstrap.locale;
  };

  let currentLocale = pickInitialLocale();

  /**
   * @param {Translations} dictionary
   * @param {string} key
   * @returns {unknown}
   */
  const pick = (dictionary, key) => {
    return key.split('.').reduce((acc, segment) => {
      if (acc == null) return undefined;
      if (Array.isArray(acc)) {
        const index = Number(segment);
        if (Number.isNaN(index)) return undefined;
        return acc[index];
      }
      if (typeof acc === 'object') {
        return /** @type {Record<string, unknown>} */ (acc)[segment];
      }
      return undefined;
    }, dictionary);
  };

  /**
   * @param {Locale} locale
   * @param {string} key
   * @returns {unknown}
   */
  const getValue = (locale, key) => {
    const dictionary = bootstrap.translations[locale];
    const fallback = bootstrap.translations.en;

    const value = pick(dictionary, key);
    if (value !== undefined) return value;
    return pick(fallback, key);
  };

  /**
   * @param {string} baseHref
   * @param {Locale} locale
   */
  const buildLocaleAwareHref = (baseHref, locale) => {
    if (!baseHref) return baseHref;
    const isExternal =
      /^(https?:)?\/\//.test(baseHref) &&
      !baseHref.startsWith(window.location.origin) &&
      !baseHref.startsWith('/');
    if (isExternal) return baseHref;
    try {
      const url = baseHref.startsWith('http')
        ? new URL(baseHref)
        : new URL(baseHref, window.location.origin);
      if (locale !== defaultLocale) {
        url.searchParams.set('lang', locale);
      } else {
        url.searchParams.delete('lang');
      }
      const nextHref = `${url.pathname}${url.search}${url.hash}`;
      return nextHref || '/';
    } catch {
      return baseHref;
    }
  };

  /**
   * @param {Locale} locale
   */
  const updateLocaleLinks = (locale) => {
    const links = document.querySelectorAll('a[data-locale-link]');
    links.forEach((link) => {
      const baseHref = link.getAttribute('data-base-href');
      if (!baseHref) return;
      link.setAttribute('href', buildLocaleAwareHref(baseHref, locale));
    });
  };

  /**
   * @param {Locale} locale
   */
  const applyTranslations = (locale) => {
    document.documentElement.lang = locale;

    const nodes = document.querySelectorAll('[data-i18n-key]');
    nodes.forEach((node) => {
      const key = node.getAttribute('data-i18n-key');
      if (!key) return;
      const attr = node.getAttribute('data-i18n-attr');
      const value = getValue(locale, key);
      if (typeof value !== 'string') return;
      if (attr) {
        node.setAttribute(attr, value);
      } else {
        node.textContent = value;
      }
    });

    const toggleButtons = document.querySelectorAll('[data-locale-button]');

    toggleButtons.forEach((button) => {
      const targetLocale = button.getAttribute('data-locale');
      if (!targetLocale) return;
      const isActive = targetLocale === locale;
      button.dataset.active = String(isActive);
      button.setAttribute('aria-pressed', String(isActive));
      const activeClass = button.getAttribute('data-active-class');
      const inactiveClass = button.getAttribute('data-inactive-class');
      if (activeClass && inactiveClass) {
        const activeSet = activeClass.split(' ').filter(Boolean);
        const inactiveSet = inactiveClass.split(' ').filter(Boolean);
        button.classList.remove(...(isActive ? inactiveSet : activeSet));
        button.classList.add(...(isActive ? activeSet : inactiveSet));
      }
    });

    const fallbackTitle = document.title;
    const translatedTitle = getValue(locale, 'site.title');
    document.title =
      typeof translatedTitle === 'string' ? translatedTitle : fallbackTitle;

    const descriptionMeta = document.querySelector('meta[name="description"]');
    const descriptionValue = getValue(locale, 'site.description');
    if (descriptionMeta && typeof descriptionValue === 'string') {
      descriptionMeta.setAttribute('content', descriptionValue);
    }
    updateLocaleLinks(locale);
  };

  /**
   * @param {Locale} locale
   * @param {{ forceUrlUpdate?: boolean }} [options]
   */
  const persistLocale = (locale, options = {}) => {
    document.cookie = `${bootstrap.cookieName}=${locale};path=/;max-age=31536000;samesite=Lax`;
    const currentUrl = new URL(window.location.href);
    const shouldUpdate =
      options.forceUrlUpdate ||
      currentUrl.searchParams.get('lang') !== locale;
    if (!shouldUpdate) return;
    currentUrl.searchParams.set('lang', locale);
    window.history.replaceState({}, '', currentUrl.toString());
  };

  /**
   * @param {Locale} locale
   */
  const setLocale = (locale) => {
    if (locale === currentLocale) return;
    if (!supportedLocales.includes(locale)) return;
    currentLocale = locale;
    applyTranslations(locale);
    persistLocale(locale, { forceUrlUpdate: true });
    subscribers.forEach((fn) => fn(locale));
    if (turtleWindow.turtleandLocaleStore) {
      turtleWindow.turtleandLocaleStore.locale = locale;
    }
  };

  /**
   * @param {Event} event
   */
  const handleToggleClick = (event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const nextLocale = target.getAttribute('data-locale');
    if (!nextLocale) return;
    event.preventDefault();
    setLocale(/** @type {Locale} */ (nextLocale));
  };

  const registerToggleListeners = () => {
    const buttons = document.querySelectorAll('[data-locale-button]');
    buttons.forEach((button) => {
      button.removeEventListener('click', handleToggleClick);
      button.addEventListener('click', handleToggleClick);
    });
  };

  const initialApply = () => {
    applyTranslations(currentLocale);
    persistLocale(currentLocale);
    registerToggleListeners();
  };

  turtleWindow.turtleandLocaleStore = {
    locale: currentLocale,
    setLocale,
    subscribe: (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    t: (key) => {
      const value = getValue(currentLocale, key);
      if (typeof value === 'string') return value;
      return key;
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialApply, { once: true });
  } else {
    initialApply();
  }
}
