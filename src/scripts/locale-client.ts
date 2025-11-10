import type { Locale } from '../utils/i18n';

type Translations = Record<string, unknown>;

type LocaleBootstrap = {
  locale: Locale;
  defaultLocale: Locale;
  cookieName: string;
  translations: Record<Locale, Translations>;
};

type Subscriber = (locale: Locale) => void;

declare global {
  interface Window {
    __turtleandLocale?: LocaleBootstrap;
    turtleandLocaleStore?: {
      locale: Locale;
      setLocale: (locale: Locale) => void;
      subscribe: (fn: Subscriber) => () => void;
      t: (key: string) => string;
    };
  }
}

const bootstrap = window.__turtleandLocale;

if (!bootstrap) {
  if (import.meta.env.DEV) {
    console.warn('[i18n] Missing bootstrap data. Locale toggle is disabled.');
  }
} else {
  const supportedLocales = Object.keys(bootstrap.translations) as Locale[];
  const defaultLocale = bootstrap.defaultLocale ?? 'en';
  const subscribers = new Set<Subscriber>();
  const isSupportedLocale = (value: string | null | undefined): value is Locale =>
    !!value && supportedLocales.includes(value as Locale);

  const readCookieLocale = (): Locale | undefined => {
    const entries = document.cookie.split(';').map((part) => part.trim());
    const entry = entries.find((cookie) => cookie.startsWith(`${bootstrap.cookieName}=`));
    if (!entry) return undefined;
    const value = entry.split('=')[1];
    if (isSupportedLocale(value)) return value;
    return undefined;
  };

  const pickInitialLocale = (): Locale => {
    const urlLocale = new URL(window.location.href).searchParams.get('lang');
    if (isSupportedLocale(urlLocale)) return urlLocale;
    const cookieLocale = readCookieLocale();
    if (cookieLocale) return cookieLocale;
    return bootstrap.locale;
  };

  let currentLocale: Locale = pickInitialLocale();

  const pick = (dictionary: Translations, key: string): unknown => {
    return key.split('.').reduce<unknown>((acc, segment) => {
      if (acc == null) return undefined;
      if (Array.isArray(acc)) {
        const index = Number(segment);
        if (Number.isNaN(index)) return undefined;
        return acc[index];
      }
      if (typeof acc === 'object') {
        return (acc as Record<string, unknown>)[segment];
      }
      return undefined;
    }, dictionary);
  };

  const getValue = (locale: Locale, key: string): unknown => {
    const dictionary = bootstrap.translations[locale];
    const fallback = bootstrap.translations.en;

    const value = pick(dictionary, key);
    if (value !== undefined) return value;
    return pick(fallback, key);
  };

  const buildLocaleAwareHref = (baseHref: string, locale: Locale) => {
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

  const updateLocaleLinks = (locale: Locale) => {
    const links = document.querySelectorAll<HTMLAnchorElement>('a[data-locale-link]');
    links.forEach((link) => {
      const baseHref = link.getAttribute('data-base-href');
      if (!baseHref) return;
      link.setAttribute('href', buildLocaleAwareHref(baseHref, locale));
    });
  };

  const applyTranslations = (locale: Locale) => {
    document.documentElement.lang = locale;

    const nodes = document.querySelectorAll<HTMLElement>('[data-i18n-key]');
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

    const toggleButtons =
      document.querySelectorAll<HTMLButtonElement>('[data-locale-button]');

    toggleButtons.forEach((button) => {
      const targetLocale = button.dataset.locale as Locale | undefined;
      if (!targetLocale) return;
      const isActive = targetLocale === locale;
      button.dataset.active = String(isActive);
      button.setAttribute('aria-pressed', String(isActive));
      const activeClass = button.dataset.activeClass;
      const inactiveClass = button.dataset.inactiveClass;
      if (activeClass && inactiveClass) {
        const activeSet = activeClass.split(' ').filter(Boolean);
        const inactiveSet = inactiveClass.split(' ').filter(Boolean);
        button.classList.remove(...(isActive ? inactiveSet : activeSet));
        button.classList.add(...(isActive ? activeSet : inactiveSet));
      }
    });

    document.title = (getValue(locale, 'site.title') as string) ?? document.title;
    const descriptionMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const descriptionValue = getValue(locale, 'site.description');
    if (descriptionMeta && typeof descriptionValue === 'string') {
      descriptionMeta.setAttribute('content', descriptionValue);
    }
    updateLocaleLinks(locale);
  };

  const persistLocale = (
    locale: Locale,
    options: { forceUrlUpdate?: boolean } = {},
  ) => {
    document.cookie = `${bootstrap.cookieName}=${locale};path=/;max-age=31536000;samesite=Lax`;
    const currentUrl = new URL(window.location.href);
    const shouldUpdate =
      options.forceUrlUpdate ||
      currentUrl.searchParams.get('lang') !== locale;
    if (!shouldUpdate) return;
    currentUrl.searchParams.set('lang', locale);
    window.history.replaceState({}, '', currentUrl.toString());
  };

  const setLocale = (locale: Locale) => {
    if (locale === currentLocale) return;
    if (!supportedLocales.includes(locale)) return;
    currentLocale = locale;
    applyTranslations(locale);
    persistLocale(locale, { forceUrlUpdate: true });
    subscribers.forEach((fn) => fn(locale));
    if (window.turtleandLocaleStore) {
      window.turtleandLocaleStore.locale = locale;
    }
  };

  const handleToggleClick = (event: Event) => {
    const target = event.currentTarget as HTMLElement;
    const nextLocale = target.getAttribute('data-locale') as Locale | null;
    if (!nextLocale) return;
    event.preventDefault();
    setLocale(nextLocale);
  };

  const registerToggleListeners = () => {
    const buttons =
      document.querySelectorAll<HTMLElement>('[data-locale-button]');
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

  window.turtleandLocaleStore = {
    locale: currentLocale,
    setLocale,
    subscribe: (fn: Subscriber) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    t: (key: string) => {
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
