import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import type { DescriptionTranslationsT, TranslationTextsT } from './description-translations'
import { TRANSLATION_LANGUAGES, type TranslationLanguageT } from './languages'
import { toSectionTemplate, type SectionTranslationsT } from './section-translations'

export type FillRowT = {
  id: number
  description: string | null
  unit: string | null
  translations: DescriptionTranslationsT
}

// `description` is the opis the plan was made against: the writer only lands a language while the
// row still carries it, so an opis edited mid-fill is never stamped with a translation of the old one.
export type RowWriteT = { id: number; description: string; translations: DescriptionTranslationsT }

type PendingRowT = { id: number; description: string; languages: TranslationLanguageT[] }

export type AiFillPlanT = {
  fromCatalogue: RowWriteT[]
  toTranslate: { text: string; rows: PendingRowT[] }[]
}

// A hand-typed translation that is current is never touched; a stale one — hand-typed or not — is
// what the warning asks to replace.
export function needsTranslation(
  translations: DescriptionTranslationsT | undefined,
  language: TranslationLanguageT,
  description: string | null | undefined,
): boolean {
  if (!description || description.trim() === '') return false
  const entry = translations?.[language]
  return !entry || entry.source !== description
}

const stamp = (texts: TranslationTextsT, description: string): DescriptionTranslationsT =>
  Object.fromEntries(
    Object.entries(texts).map(([language, text]) => [language, { text, source: description }]),
  )

/**
 * The katalog goes first: its translation is reused for a language when it was made from an opis
 * that folds like the row's. What is still missing is grouped by trimmed opis, so each distinct
 * text costs one AI item however many rows carry it.
 */
export function planAiFill(
  rows: readonly FillRowT[],
  catalogueByKey: ReadonlyMap<string, DescriptionTranslationsT>,
): AiFillPlanT {
  const fromCatalogue: RowWriteT[] = []
  const byText = new Map<string, PendingRowT[]>()

  for (const row of rows) {
    const description = row.description
    if (!description) continue
    const missing = TRANSLATION_LANGUAGES.filter((language) =>
      needsTranslation(row.translations, language, description),
    )
    if (missing.length === 0) continue

    const catalogue = catalogueByKey.get(catalogueKey(description, row.unit))
    const folded = foldDescription(description)
    const reused: TranslationTextsT = {}
    const languages: TranslationLanguageT[] = []
    for (const language of missing) {
      const entry = catalogue?.[language]
      if (entry && foldDescription(entry.source) === folded) reused[language] = entry.text
      else languages.push(language)
    }

    if (Object.keys(reused).length > 0) {
      fromCatalogue.push({ id: row.id, description, translations: stamp(reused, description) })
    }
    if (languages.length > 0) {
      const text = description.trim()
      byText.set(text, [...(byText.get(text) ?? []), { id: row.id, description, languages }])
    }
  }

  return {
    fromCatalogue,
    toTranslate: [...byText].map(([text, pendingRows]) => ({ text, rows: pendingRows })),
  }
}

/** `failed` counts row × language pairs the AI left blank — what the toast reports. */
export function aiFillWrites(
  toTranslate: AiFillPlanT['toTranslate'],
  aiByText: ReadonlyMap<string, TranslationTextsT>,
): { writes: RowWriteT[]; failed: number } {
  const writes: RowWriteT[] = []
  let failed = 0
  for (const { text, rows } of toTranslate) {
    const ai = aiByText.get(text)
    for (const row of rows) {
      const texts: TranslationTextsT = {}
      for (const language of row.languages) {
        const translated = ai?.[language]
        if (translated) texts[language] = translated
        else failed++
      }
      if (Object.keys(texts).length > 0) {
        writes.push({ id: row.id, description: row.description, translations: stamp(texts, row.description) })
      }
    }
  }
  return { writes, failed }
}

// Section templates carry no `source`, so only a language with no template is filled.
export const sectionLanguagesToFill = (
  translations: SectionTranslationsT | undefined,
): TranslationLanguageT[] =>
  TRANSLATION_LANGUAGES.filter((language) => !translations?.[language]?.trim())

// An AI answer that renumbered the room („Łazienka 2" → „Ванна 1") would render the wrong section, so
// it is dropped exactly as the manager's own typing would be refused.
export function sectionTemplatesFromAi(
  name: string,
  texts: TranslationTextsT | undefined,
): SectionTranslationsT {
  const out: SectionTranslationsT = {}
  for (const language of TRANSLATION_LANGUAGES) {
    const text = texts?.[language]
    if (!text) continue
    const result = toSectionTemplate(name, text)
    if (result.ok && result.template !== '') out[language] = result.template
  }
  return out
}
