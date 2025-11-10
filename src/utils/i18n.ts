import type { AstroCookies } from 'astro';
import en from '../content/i18n/en.json';
import es from '../content/i18n/es.json';

const dictionaries = { en, es } as const;

export type Locale = keyof typeof dictionaries;
export type Dictionary = (typeof dictionaries)[Locale];

export const SUPPORTED_LOCALES = Object.keys(dictionaries) as Locale[];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'lang';

type TranslationValue = string | number | null | undefined;

const COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
  sameSite: 'lax' as const,
};

export function isLocale(value: string | null | undefined): value is Locale {
  if (!value) return false;
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function createTranslator(locale: Locale) {
  const dictionary = getDictionary(locale);
  const fallbackDictionary = getDictionary(DEFAULT_LOCALE);

  return (key: string): string => {
    const value = getNestedValue(dictionary, key);
    if (typeof value === 'string') return value;

    const fallbackValue = getNestedValue(fallbackDictionary, key);
    if (typeof fallbackValue === 'string') {
      console.warn(`[i18n] Missing translation for "${key}" in locale "${locale}", falling back to default.`);
      return fallbackValue;
    }

    console.warn(`[i18n] Missing translation for "${key}" in all locales.`);
    return key;
  };
}

export function resolveLocale({
  url,
  cookies,
}: {
  url: URL;
  cookies: AstroCookies;
}): Locale {
  const paramLocale = url.searchParams.get('lang');
  if (isLocale(paramLocale)) {
    persistLocaleCookie(cookies, paramLocale);
    return paramLocale;
  }

  const cookieLocale = cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  persistLocaleCookie(cookies, DEFAULT_LOCALE);
  return DEFAULT_LOCALE;
}

export function persistLocaleCookie(cookies: AstroCookies, locale: Locale) {
  const current = cookies.get(LOCALE_COOKIE)?.value;
  if (current === locale) return;
  cookies.set(LOCALE_COOKIE, locale, COOKIE_OPTIONS);
}

export function getNestedValue(
  dictionary: Dictionary,
  key: string,
): TranslationValue | TranslationValue[] | Record<string, unknown> | undefined {
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
  }, dictionary) as TranslationValue | TranslationValue[] | Record<string, unknown> | undefined;
}

export function serializeDictionaries() {
  return dictionaries;
}

export type CopyToken = {
  key: string;
  text: string;
};

export function initI18n(context: { url: URL; cookies: AstroCookies }) {
  const locale = resolveLocale(context);
  const dictionary = getDictionary(locale);
  const t = createTranslator(locale);
  return { locale, dictionary, t };
}

export function makeCopyToken(key: string, t: (key: string) => string): CopyToken {
  return { key, text: t(key) };
}
