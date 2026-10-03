import { RATE_LABELS } from '@/lib/kosztorys/labels'
import {
  catalogueRateText,
  type CatalogueRateColumnsT,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { formatPLN } from '@/lib/utils/format-currency'

export type CataloguePricesT = CatalogueRateColumnsT & { clientPrice: number }

type CategorisedPricesT = CataloguePricesT & { category: string | null }

export const NO_CATEGORY = 'bez kategorii'

// `|| null`, not `??`: an empty kategoria and a missing one are the same thing to the owner, and
// the Payload admin can leave `''` in the column where every in-app write folds it to NULL.
export const categoriesDiffer = (existing: CategorisedPricesT, candidate: CategorisedPricesT) =>
  (existing.category || null) !== (candidate.category || null)

export function overwriteSentence(
  existing: CategorisedPricesT,
  candidate: CategorisedPricesT,
  changesCategory: boolean,
): string {
  const figures = `Cena j.m. ${formatPLN(existing.clientPrice)} → ${formatPLN(candidate.clientPrice)}, ${RATE_LABELS.w_tools.toLowerCase()} ${catalogueRateText(existing, 'w_tools')} → ${catalogueRateText(candidate, 'w_tools')}, ${RATE_LABELS.own_tools.toLowerCase()} ${catalogueRateText(existing, 'own_tools')} → ${catalogueRateText(candidate, 'own_tools')}.`
  const category = changesCategory
    ? ` Kategoria w katalogu zmieni się z „${existing.category || NO_CATEGORY}" na „${candidate.category || NO_CATEGORY}".`
    : ''
  return `Stare stawki przepadną — katalog nie trzyma historii. ${figures}${category} Kosztorysy, w których ta praca już siedzi, zostają bez zmian.`
}
