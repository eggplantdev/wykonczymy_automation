import {
  translationText,
  withTranslation,
  type DescriptionTranslationsT,
} from '@/lib/i18n/description-translations'
import type { TranslationLanguageT } from '@/lib/i18n/languages'

export type TranslationFillTableT = 'work_catalogue_items' | 'kosztorys_items'

export type TranslationFillRowT = {
  table: TranslationFillTableT
  id: number
  description: string
  descriptionTranslations: DescriptionTranslationsT
}

export type TranslationFillT = {
  row: TranslationFillRowT
  descriptionTranslations: DescriptionTranslationsT
}

export type TranslationFillPlanT = {
  fills: TranslationFillT[]
  alreadyTranslated: number
  // Distinct opisy still untranslated after the run — the next export's worklist.
  missing: string[]
}

export type TranslationExportEntryT = {
  description: string
  catalogue: number
  items: number
}

const isUntranslated = (row: TranslationFillRowT, language: TranslationLanguageT) =>
  translationText(row.descriptionTranslations, language).trim() === ''

// Opisy are free text: a newline or a tab inside one would break a TSV line, so the file spells them
// as `\n` / `\t` and a literal backslash as `\\`.
const unescapeCell = (cell: string) =>
  cell.replace(/\\([nt\\])/gu, (_, code: string) =>
    code === 'n' ? '\n' : code === 't' ? '\t' : '\\',
  )

export const escapeCell = (text: string) =>
  text.replace(/\\/gu, '\\\\').replace(/\n/gu, '\\n').replace(/\t/gu, '\\t')

// `<opis po polsku>\t<tłumaczenie>` per line. A line without a translation is a worklist entry
// nobody filled yet, not an error.
export function parseTranslationFile(content: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of content.split('\n')) {
    if (line.trim() === '' || line.startsWith('#')) continue
    const [polish, translation] = line.split('\t')
    if (polish === undefined || translation === undefined) continue
    const text = unescapeCell(translation).trim()
    if (text !== '') out.set(unescapeCell(polish).trim(), text)
  }
  return out
}

export function exportUntranslated(
  rows: readonly TranslationFillRowT[],
  language: TranslationLanguageT,
): TranslationExportEntryT[] {
  const byDescription = new Map<string, TranslationExportEntryT>()
  for (const row of rows) {
    const description = row.description.trim()
    if (description === '' || !isUntranslated(row, language)) continue
    const entry = byDescription.get(description) ?? { description, catalogue: 0, items: 0 }
    if (row.table === 'work_catalogue_items') entry.catalogue += 1
    else entry.items += 1
    byDescription.set(description, entry)
  }
  return [...byDescription.values()].sort((left, right) =>
    left.description.localeCompare(right.description, 'pl'),
  )
}

// Fills only an empty translation — one somebody typed in the app is never overwritten — and stamps
// `source` with the row's own opis, so the fill is current against exactly what the row says.
export function planTranslationFill(
  rows: readonly TranslationFillRowT[],
  file: ReadonlyMap<string, string>,
  language: TranslationLanguageT,
): TranslationFillPlanT {
  const fills: TranslationFillT[] = []
  const missing = new Set<string>()
  let alreadyTranslated = 0
  for (const row of rows) {
    const description = row.description.trim()
    if (description === '') continue
    if (!isUntranslated(row, language)) {
      alreadyTranslated += 1
      continue
    }
    const text = file.get(description)
    if (text === undefined) {
      missing.add(description)
      continue
    }
    fills.push({
      row,
      descriptionTranslations: withTranslation(
        row.descriptionTranslations,
        language,
        text,
        row.description,
      ),
    })
  }
  return { fills, alreadyTranslated, missing: [...missing] }
}
