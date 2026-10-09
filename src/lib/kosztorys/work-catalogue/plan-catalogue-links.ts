import { TRANSLATION_LANGUAGES } from '@/lib/i18n/languages'
import type { DescriptionTranslationsT } from '@/lib/i18n/description-translations'
import { toCatalogueCandidate } from '@/lib/kosztorys/work-catalogue/item-to-catalogue'
import type {
  CatalogueCandidateT,
  CatalogueSourceItemT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

export type LinkRowT = {
  itemId: number
  investmentName: string
  isTemplate: boolean
  source: CatalogueSourceItemT
}

export type CatalogueLinkT = { itemId: number; catalogueItemId: number }

export type TemplateMismatchT = {
  itemId: number
  investmentName: string
  description: string
  fields: string[]
}

export type CatalogueLinkPlanT = {
  links: CatalogueLinkT[]
  templateMismatches: TemplateMismatchT[]
  unmatched: LinkRowT[]
}

const translationTexts = (translations: DescriptionTranslationsT): string[] =>
  TRANSLATION_LANGUAGES.map((language) => translations[language]?.text.trim() ?? '')

// The labels the owner reads in the report. Kategoria is not among them: the katalog owns its own,
// and a szablon's sekcja names local context, never a property of the praca.
function differingFields(candidate: CatalogueCandidateT, entry: WorkCatalogueItemT): string[] {
  const fields: string[] = []
  if (candidate.description !== entry.description) fields.push('opis')
  if (candidate.unit !== entry.unit) fields.push('j.m.')
  if (candidate.clientPrice !== entry.clientPrice) fields.push('Cena j.m.')
  if (
    candidate.wToolsRate !== entry.wToolsRate ||
    candidate.wToolsRateCoeff !== entry.wToolsRateCoeff
  ) {
    fields.push('stawka z narzędziami')
  }
  if (
    candidate.ownToolsRate !== entry.ownToolsRate ||
    candidate.ownToolsRateCoeff !== entry.ownToolsRateCoeff
  ) {
    fields.push('stawka bez narzędzi')
  }
  const candidateTexts = translationTexts(candidate.descriptionTranslations)
  const entryTexts = translationTexts(entry.descriptionTranslations)
  if (candidateTexts.some((text, index) => text !== entryTexts[index])) fields.push('tłumaczenia')
  return fields
}

/**
 * Which unlinked pozycje take which katalog entry. A kosztorys pozycja links on opis + j.m. alone: the
 * id names WHICH praca it is, and the kosztorys keeps its own price either way. A szablon row links
 * only when it equals the entry in every katalog field, because once linked the szablon shows the
 * katalog's values instead of its own — a difference linked silently would be a price change nobody
 * made. Such a row is reported for a human to settle first.
 */
export function planCatalogueLinks(
  rows: readonly LinkRowT[],
  catalogue: readonly WorkCatalogueItemT[],
): CatalogueLinkPlanT {
  const byKey = new Map(catalogue.map((entry) => [entry.matchKey, entry]))
  const plan: CatalogueLinkPlanT = { links: [], templateMismatches: [], unmatched: [] }
  for (const row of rows) {
    const candidate = toCatalogueCandidate(row.source)
    const entry = byKey.get(candidate.matchKey)
    if (!entry) {
      plan.unmatched.push(row)
      continue
    }
    const fields = row.isTemplate ? differingFields(candidate, entry) : []
    if (fields.length > 0) {
      plan.templateMismatches.push({
        itemId: row.itemId,
        investmentName: row.investmentName,
        description: candidate.description,
        fields,
      })
      continue
    }
    plan.links.push({ itemId: row.itemId, catalogueItemId: entry.id })
  }
  return plan
}
