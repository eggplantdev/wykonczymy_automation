import type { LanguageT, TranslationLanguageT } from './languages'

// Stored templates: a standalone number of the Polish name is a `#`, so „Łazienka 1" and „Łazienka 2"
// share one entry and each section gets its own number back on render.
export type SectionTranslationsT = Partial<Record<TranslationLanguageT, string>>

// Keyed by `sectionNameKey`.
export type SectionTranslationMapT = Record<string, SectionTranslationsT>

export type SectionTemplateResultT =
  | { ok: true; template: string }
  | { ok: false; reason: 'numbers' | 'hash'; expected: string[] }

const PLACEHOLDER = '#'
// A token, not a substring: „230V" and „c.o." are text, only a number standing alone is the room's.
const isStandaloneNumber = (token: string) => /^\d+$/.test(token)

const tokensOf = (text: string) => text.trim().split(/\s+/).filter(Boolean)

const numbersOf = (text: string) => tokensOf(text).filter(isStandaloneNumber)

const toTemplate = (tokens: string[]) =>
  tokens.map((token) => (isStandaloneNumber(token) ? PLACEHOLDER : token)).join(' ')

// No diacritic folding: „łazienka" and „lazienka" are two spellings a manager can see and fix, not one.
export function sectionNameKey(name: string): string {
  return toTemplate(tokensOf(name.toLowerCase()))
}

/**
 * The manager types real numbers; they must be the name's own, in its order, so filling `#`s back
 * positionally can never swap two rooms. Empty text means "remove this language".
 */
export function toSectionTemplate(name: string, typed: string): SectionTemplateResultT {
  const tokens = tokensOf(typed)
  if (tokens.length === 0) return { ok: true, template: '' }

  const expected = numbersOf(name)
  if (typed.includes(PLACEHOLDER)) return { ok: false, reason: 'hash', expected }

  const actual = tokens.filter(isStandaloneNumber)
  const same =
    actual.length === expected.length && actual.every((number, i) => number === expected[i])
  if (!same) return { ok: false, reason: 'numbers', expected }

  return { ok: true, template: toTemplate(tokens) }
}

/** Polish whenever the template can't be trusted to say the same thing — a miss, or a `#` count off. */
export function renderSectionName(
  name: string,
  translations: SectionTranslationsT | undefined,
  locale: LanguageT,
): string {
  if (locale === 'pl') return name
  const template = translations?.[locale]?.trim()
  if (!template) return name

  const numbers = numbersOf(name)
  const tokens = tokensOf(template)
  if (tokens.filter((token) => token === PLACEHOLDER).length !== numbers.length) return name

  let next = 0
  return tokens.map((token) => (token === PLACEHOLDER ? numbers[next++] : token)).join(' ')
}
