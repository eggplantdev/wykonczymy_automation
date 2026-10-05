import { pl } from '@/lib/i18n/dictionaries/pl'
import { ru } from '@/lib/i18n/dictionaries/ru'
import { uk } from '@/lib/i18n/dictionaries/uk'
import { DEFAULT_LANGUAGE, type LanguageT } from '@/lib/i18n/languages'

export type TranslationsT = typeof pl
export type NamespaceT = keyof TranslationsT
export type PluralFormsT = { one: string; few: string; many: string; other: string }
export type TranslationParamsT = Record<string, string | number>

export type MessageKeyT<NS extends NamespaceT> = {
  [K in keyof TranslationsT[NS]]: TranslationsT[NS][K] extends string ? K : never
}[keyof TranslationsT[NS]]

export type PluralKeyT<NS extends NamespaceT> = {
  [K in keyof TranslationsT[NS]]: TranslationsT[NS][K] extends PluralFormsT ? K : never
}[keyof TranslationsT[NS]]

const DICTIONARIES: Record<LanguageT, TranslationsT> = { pl, uk, ru }

export const getTranslations = (locale: LanguageT): TranslationsT => DICTIONARIES[locale]

export const interpolate = (text: string, params?: TranslationParamsT): string =>
  params
    ? text.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match,
      )
    : text

const entryOf = (locale: LanguageT, namespace: NamespaceT, key: PropertyKey): unknown =>
  (DICTIONARIES[locale][namespace] as Record<PropertyKey, unknown>)[key]

// A key arriving from the server (a `messageKey`) is only typed as a string, so a lookup can miss.
// The key itself is a better fallback than a blank: it is visible, and it names what is missing.
export function translate<NS extends NamespaceT>(
  locale: LanguageT,
  namespace: NS,
  key: MessageKeyT<NS>,
  params?: TranslationParamsT,
): string {
  const entry = entryOf(locale, namespace, key)
  if (typeof entry !== 'string') {
    console.warn(`[i18n] missing "${String(namespace)}.${String(key)}" for ${locale}`)
    return String(key)
  }
  return interpolate(entry, params)
}

export function translatePlural<NS extends NamespaceT>(
  locale: LanguageT,
  namespace: NS,
  key: PluralKeyT<NS>,
  count: number,
  params?: TranslationParamsT,
): string {
  const forms = entryOf(locale, namespace, key) as PluralFormsT | undefined
  if (!forms) {
    console.warn(`[i18n] missing "${String(namespace)}.${String(key)}" for ${locale}`)
    return String(key)
  }
  const category = new Intl.PluralRules(locale).select(count)
  const form = category in forms ? forms[category as keyof PluralFormsT] : forms.other
  return interpolate(form, { count, ...params })
}

export const isMessageKey = <NS extends NamespaceT>(
  namespace: NS,
  key: unknown,
): key is MessageKeyT<NS> =>
  typeof key === 'string' && typeof entryOf('pl', namespace, key) === 'string'

export type TranslatorT<NS extends NamespaceT> = {
  locale: LanguageT
  t: (key: MessageKeyT<NS>, params?: TranslationParamsT) => string
  tp: (key: PluralKeyT<NS>, count: number, params?: TranslationParamsT) => string
}

const translators = new Map<string, unknown>()

// One instance per locale and namespace, so a translator in a memo's dependencies (the editor's
// columns) changes only when the language does.
export function createTranslator<NS extends NamespaceT>(
  locale: LanguageT,
  namespace: NS,
): TranslatorT<NS> {
  const cacheKey = `${locale}:${namespace}`
  const cached = translators.get(cacheKey)
  if (cached) return cached as TranslatorT<NS>
  const translator: TranslatorT<NS> = {
    locale,
    t: (key, params) => translate(locale, namespace, key, params),
    tp: (key, count, params) => translatePlural(locale, namespace, key, count, params),
  }
  translators.set(cacheKey, translator)
  return translator
}

// The default every grid-copy builder falls back to: the manager surfaces never pass a translator.
export const POLISH_GRID = createTranslator(DEFAULT_LANGUAGE, 'grid')
// The server validates the account form with the same schema the worker's dialog builds in their language.
export const POLISH_ACCOUNT = createTranslator(DEFAULT_LANGUAGE, 'account')
