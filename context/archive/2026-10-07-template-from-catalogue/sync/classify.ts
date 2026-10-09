import { toDescriptionTranslations } from '@/lib/i18n/description-translations'
import { TRANSLATION_LANGUAGES, type TranslationLanguageT } from '@/lib/i18n/languages'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { CatalogueRateT } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { toCatalogueCandidate } from '@/lib/kosztorys/work-catalogue/item-to-catalogue'

// Rows as export.sh writes them: snake_case straight from Postgres, numerics as JSON numbers.
export type TemplateRowT = {
  id: number
  section_name: string
  section_order: number
  display_order: number
  description: string
  unit: string
  client_price: number
  w_tools_override_value: number | null
  own_tools_override_value: number | null
  w_tools_override_coeff: number | null
  own_tools_override_coeff: number | null
  description_translations: unknown
  updated_at: string
}

export type CatalogueRowT = {
  id: number
  description: string
  unit: string
  client_price: number
  w_tools_rate: number | null
  w_tools_rate_coeff: number | null
  own_tools_rate: number | null
  own_tools_rate_coeff: number | null
  match_key: string
  description_translations: unknown
}

export type FieldT = 'clientPrice' | 'wTools' | 'ownTools' | TranslationLanguageT

// One praca reduced to what the katalog holds, so a szablon row and a katalog row compare field by
// field. A szablon row goes through `toCatalogueCandidate` — the same reading „Zapisz do katalogu…"
// does — so „auto" / kwota / mnożnik mean here what they mean in the app.
export type WorkT = {
  description: string
  unit: string
  clientPrice: number
  wTools: CatalogueRateT
  ownTools: CatalogueRateT
  translations: Record<TranslationLanguageT, string>
}

export type FieldValueT = number | CatalogueRateT | string

const textsOf = (raw: unknown): Record<TranslationLanguageT, string> => {
  const translations = toDescriptionTranslations(raw)
  return Object.fromEntries(
    TRANSLATION_LANGUAGES.map((language) => [language, translations[language]?.text.trim() ?? '']),
  ) as Record<TranslationLanguageT, string>
}

export const workOfTemplateRow = (row: TemplateRowT): WorkT => {
  const candidate = toCatalogueCandidate({
    description: row.description,
    descriptionTranslations: toDescriptionTranslations(row.description_translations),
    unit: row.unit,
    sectionName: row.section_name,
    clientPrice: Number(row.client_price),
    wToolsOverrideValue: row.w_tools_override_value,
    ownToolsOverrideValue: row.own_tools_override_value,
    wToolsOverrideCoeff: row.w_tools_override_coeff,
    ownToolsOverrideCoeff: row.own_tools_override_coeff,
  })
  return {
    description: candidate.description,
    unit: candidate.unit,
    clientPrice: candidate.clientPrice,
    wTools: { rate: candidate.wToolsRate, coeff: candidate.wToolsRateCoeff },
    ownTools: { rate: candidate.ownToolsRate, coeff: candidate.ownToolsRateCoeff },
    translations: textsOf(candidate.descriptionTranslations),
  }
}

export const workOfCatalogueRow = (row: CatalogueRowT): WorkT => ({
  description: row.description,
  unit: row.unit,
  clientPrice: Number(row.client_price),
  wTools: { rate: row.w_tools_rate, coeff: row.w_tools_rate_coeff },
  ownTools: { rate: row.own_tools_rate, coeff: row.own_tools_rate_coeff },
  translations: textsOf(row.description_translations),
})

export const FIELDS: readonly FieldT[] = [
  'clientPrice',
  'wTools',
  'ownTools',
  ...TRANSLATION_LANGUAGES,
]

export const fieldOf = (work: WorkT, field: FieldT): FieldValueT => {
  if (field === 'clientPrice') return work.clientPrice
  if (field === 'wTools') return work.wTools
  if (field === 'ownTools') return work.ownTools
  return work.translations[field]
}

const sameNumber = (left: number | null, right: number | null) =>
  left == null || right == null ? left == right : Math.abs(left - right) < 0.005

export const sameValue = (left: FieldValueT, right: FieldValueT): boolean => {
  if (typeof left === 'number' && typeof right === 'number') return sameNumber(left, right)
  if (typeof left === 'string' && typeof right === 'string') return left === right
  if (typeof left === 'object' && typeof right === 'object') {
    return sameNumber(left.rate, right.rate) && sameNumber(left.coeff, right.coeff)
  }
  return false
}

// The szablon wins every field (owner, 2026-10-08): the katalog is brought to the szablon's state
// before the szablon starts reading it.
// - toCatalogue: the szablon's value goes into the katalog;
// - conflict: both moved since BASE, or the same praca stands in the szablon twice with two values;
// - fillCatalogue: the szablon has a translation the katalog lacks — a gap, not a disagreement.
export type FieldVerdictT = 'toCatalogue' | 'conflict' | 'fillCatalogue'

export type FieldDiffT = {
  field: FieldT
  verdict: FieldVerdictT
  base: FieldValueT | undefined
  now: FieldValueT
  catalogue: FieldValueT
  catalogueBase: FieldValueT | undefined
}

export type RowT = {
  now: TemplateRowT
  base: TemplateRowT | undefined
  work: WorkT
  baseWork: WorkT | undefined
  catalogue: CatalogueRowT | undefined
  diffs: FieldDiffT[]
}

export type ReportT = {
  // Fields to write into the katalog, the kierownik's edits.
  toCatalogue: RowT[]
  conflicts: RowT[]
  // Translations the katalog does not have yet.
  fillCatalogue: RowT[]
  // Opis or j.m. changed: by the model a different praca, so a decision, not a field write.
  renamed: RowT[]
  // In the szablon, not in the katalog: added since BASE.
  newMissing: RowT[]
  // In the szablon, not in the katalog: already so at BASE.
  oldMissing: RowT[]
  removed: TemplateRowT[]
  inSync: number
}

const keyOf = (work: { description: string; unit: string }) =>
  catalogueKey(work.description, work.unit)

export function classify(
  baseTemplate: TemplateRowT[],
  nowTemplate: TemplateRowT[],
  baseCatalogue: CatalogueRowT[],
  nowCatalogue: CatalogueRowT[],
): ReportT {
  const catalogueNow = new Map(nowCatalogue.map((row) => [row.match_key, row]))
  const catalogueBase = new Map(baseCatalogue.map((row) => [row.match_key, row]))

  // A row deleted and typed again has a new id; pair it back to its old self by klucz, so a
  // re-entered praca reads as edited, not as one removal plus one addition.
  const baseById = new Map(baseTemplate.map((row) => [row.id, row]))
  const nowIds = new Set(nowTemplate.map((row) => row.id))
  const orphanBaseByKey = new Map(
    baseTemplate
      .filter((row) => !nowIds.has(row.id))
      .map((row) => [keyOf(workOfTemplateRow(row)), row]),
  )
  const pairedBase = (row: TemplateRowT) => {
    const byId = baseById.get(row.id)
    if (byId) return byId
    const key = keyOf(workOfTemplateRow(row))
    const orphan = orphanBaseByKey.get(key)
    if (orphan) orphanBaseByKey.delete(key)
    return orphan
  }

  const report: ReportT = {
    toCatalogue: [],
    conflicts: [],
    fillCatalogue: [],
    renamed: [],
    newMissing: [],
    oldMissing: [],
    removed: [],
    inSync: 0,
  }

  const rows: RowT[] = nowTemplate.map((now) => {
    const base = pairedBase(now)
    const work = workOfTemplateRow(now)
    return {
      now,
      base,
      work,
      baseWork: base ? workOfTemplateRow(base) : undefined,
      catalogue: catalogueNow.get(keyOf(work)),
      diffs: [],
    }
  })

  for (const row of rows) {
    const key = keyOf(row.work)
    if (row.baseWork && keyOf(row.baseWork) !== key) {
      report.renamed.push(row)
      continue
    }
    if (!row.catalogue) {
      ;(row.base ? report.oldMissing : report.newMissing).push(row)
      continue
    }
    const catalogueWork = workOfCatalogueRow(row.catalogue)
    const catalogueBaseRow = catalogueBase.get(key)
    const catalogueBaseWork = catalogueBaseRow ? workOfCatalogueRow(catalogueBaseRow) : undefined
    for (const field of FIELDS) {
      const now = fieldOf(row.work, field)
      const catalogue = fieldOf(catalogueWork, field)
      if (sameValue(now, catalogue)) continue
      const base = row.baseWork ? fieldOf(row.baseWork, field) : undefined
      const catalogueBaseValue = catalogueBaseWork ? fieldOf(catalogueBaseWork, field) : undefined
      // A praca added since BASE is the kierownik's own entry — every value on it is his edit.
      const changedInTemplate = base === undefined || !sameValue(now, base)
      const changedInCatalogue =
        catalogueBaseValue !== undefined && !sameValue(catalogue, catalogueBaseValue)
      const verdict: FieldVerdictT =
        changedInTemplate && changedInCatalogue
          ? 'conflict'
          : catalogue === ''
            ? 'fillCatalogue'
            : 'toCatalogue'
      row.diffs.push({
        field,
        verdict,
        base,
        now,
        catalogue,
        catalogueBase: catalogueBaseValue,
      })
    }
  }

  // The katalog keeps one value per praca. The same praca twice in the szablon (two sekcje) with
  // two different edits cannot both go in.
  const proposals = new Map<string, FieldValueT[]>()
  for (const row of rows) {
    for (const diff of row.diffs.filter((diff) => diff.verdict === 'toCatalogue')) {
      const slot = `${keyOf(row.work)}#${diff.field}`
      proposals.set(slot, [...(proposals.get(slot) ?? []), diff.now])
    }
  }
  for (const row of rows) {
    for (const diff of row.diffs) {
      const values = proposals.get(`${keyOf(row.work)}#${diff.field}`) ?? []
      if (diff.verdict === 'toCatalogue' && values.some((value) => !sameValue(value, diff.now))) {
        diff.verdict = 'conflict'
      }
    }
  }

  for (const row of rows) {
    if (!row.catalogue || report.renamed.includes(row)) continue
    const verdicts = new Set(row.diffs.map((diff) => diff.verdict))
    if (verdicts.size === 0) report.inSync++
    if (verdicts.has('conflict')) report.conflicts.push(row)
    if (verdicts.has('toCatalogue')) report.toCatalogue.push(row)
    if (verdicts.has('fillCatalogue')) report.fillCatalogue.push(row)
  }

  report.removed = [...orphanBaseByKey.values()]
  return report
}
