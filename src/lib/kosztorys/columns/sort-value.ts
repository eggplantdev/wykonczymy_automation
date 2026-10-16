import {
  priceSourceOf,
  resolvedCurrentPlannedQty,
  shownCoeff,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { columnValueResolver } from '@/lib/kosztorys/columns/column-values'
import { measureDiscrepancy } from '@/lib/kosztorys/settlement-rows'
import { planePriceKeyParts } from '@/lib/kosztorys/plane-price-keys'
import { translationText } from '@/lib/i18n/description-translations'
import { translationColumnLanguage } from '@/lib/kosztorys/translation-column-keys'
import type { KosztorysStageT, KosztorysV2RowT, PriceSourceT } from '@/lib/kosztorys/types'

const PRICE_SOURCE_ORDER: Record<PriceSourceT, number> = { auto: 0, coeff: 1, amount: 2 }

type SortValueT = string | number | null

export function sortValueGetter(
  field: string,
  view: PriceViewT,
  stages: KosztorysStageT[],
): (row: KosztorysV2RowT) => SortValueT {
  const computed = columnValueResolver({ stages, view })(field)
  if (computed) return computed

  // Reading the ACTIVE view here would sort „bez narzędzi" by the „z narzędziami" numbers — a wrong
  // order that looks like a plausible one.
  const pricePart = planePriceKeyParts(field)
  if (pricePart !== null) {
    const { base, plane } = pricePart
    if (base === 'price') return (row) => viewPrice(row, plane)
    // `shownCoeff`, czyli dokładnie to, co widać w komórce — inaczej sortowanie malejąco wpychało
    // wiersz pokazujący mnożnik inwestycji pod wiersz pokazujący mniejszy własny.
    if (base === 'priceCoeff') return (row) => shownCoeff(row, plane)
    return (row) => PRICE_SOURCE_ORDER[priceSourceOf(row, plane)]
  }

  const translationLanguage = translationColumnLanguage(field)
  if (translationLanguage !== null)
    return (row) => translationText(row.descriptionTranslations, translationLanguage) || null

  switch (field) {
    case 'price':
      return (row) => viewPrice(row, view)
    // A following cell stores null yet shows the ofertowy — sorting the raw field would sink every
    // untouched row under the bottom as „no figure".
    case 'currentPlannedQty':
      return resolvedCurrentPlannedQty
    case 'divergence':
      return (row) => measureDiscrepancy(row, stages)?.net ?? null
    default:
      return (row) => {
        const value = row[field as keyof KosztorysV2RowT]
        if (typeof value === 'number') return value
        // An empty cell is an absence, not a key: a string standing next to numbers drops the WHOLE
        // column into localeCompare, ordering „Przedmiar" as text („10" before „9").
        return value == null || value === '' ? null : String(value)
      }
  }
}

// A column sort survives the column leaving the grid — rows stay in an order tied to a header that
// is gone, and row-reorder actions stay disabled with no way to re-enable them.
export function reconcileSort<SortT extends { field: string }>(
  sort: SortT | null,
  renderedFieldIds: Set<string>,
): SortT | null {
  return sort && renderedFieldIds.has(sort.field) ? sort : null
}
