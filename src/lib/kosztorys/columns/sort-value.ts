import { priceSourceOf, shownCoeff, viewPrice, type PriceViewT } from '@/lib/kosztorys/calc'
import { columnValueResolver } from '@/lib/kosztorys/columns/column-values'
import { measureDiscrepancy } from '@/lib/kosztorys/settlement-rows'
import { planePriceKeyParts } from '@/lib/kosztorys/plane-price-keys'
import { translationText } from '@/lib/i18n/description-translations'
import { translationColumnLanguage } from '@/lib/kosztorys/translation-column-keys'
import type { KosztorysStageT, KosztorysV2RowT, PriceSourceT } from '@/lib/kosztorys/types'

// Rosnąco = coraz dalej od współczynnika inwestycji: auto, potem mnożnik, który wciąż chodzi za ceną,
// na końcu zamrożona kwota.
const PRICE_SOURCE_ORDER: Record<PriceSourceT, number> = { auto: 0, coeff: 1, amount: 2 }

type SortValueT = string | number | null

/**
 * The sort key for a grid column, built once per sort. `null` — a figure with no denominator, a key
 * whose etap is gone, an empty cell — is returned verbatim, and sortRows sinks it to the bottom in
 * both directions.
 */
export function sortValueGetter(
  field: string,
  view: PriceViewT,
  stages: KosztorysStageT[],
): (row: KosztorysV2RowT) => SortValueT {
  const computed = columnValueResolver({ stages, view })(field)
  if (computed) return computed

  // The two subcontractor-rate namespaces: their ids are not row fields (the fields are per-plane,
  // OVERRIDE_FIELDS), and the plane they price rides in the id.
  // Reading the ACTIVE view here would sort „bez narzędzi" by the „z narzędziami" numbers — a wrong
  // order that looks like a plausible one.
  const pricePart = planePriceKeyParts(field)
  if (pricePart !== null) {
    const { base, plane } = pricePart
    if (base === 'price') return (row) => viewPrice(row, plane)
    // `shownCoeff`, czyli dokładnie to, co widać w komórce — inaczej sortowanie malejąco wpychało
    // wiersz pokazujący mnożnik inwestycji pod wiersz pokazujący mniejszy własny. Bez mnożnika
    // („kwota stała") na końcu: kolumna czyta się jako lista „gdzie stawka chodzi za ceną", a te
    // wiersze do niej nie należą.
    if (base === 'priceCoeff') return (row) => shownCoeff(row, plane)
    // „Źródło ceny wykonawcy" ascending runs inherited → own mnożnik → hand-typed kwota: away from
    // the investment's own coefficient, which is the only question asked of that column.
    // Alphabetical would put „auto" after „kwota stała".
    return (row) => PRICE_SOURCE_ORDER[priceSourceOf(row, plane)]
  }

  const translationLanguage = translationColumnLanguage(field)
  if (translationLanguage !== null)
    return (row) => translationText(row.descriptionTranslations, translationLanguage) || null

  switch (field) {
    // The client's own price column — the only price id left without a plane, and assembled only in
    // the client view, so `view` is the plane to read.
    case 'price':
      return (row) => viewPrice(row, view)
    // By value, not by quantity: sorting a rozjazd list is triage, and „which m² gap is biggest" says
    // nothing across rows priced at 30 zł and 3000 zł. `null` on the rows that agree sinks them to the
    // bottom, which is where a work list wants them.
    case 'divergence':
      return (row) => measureDiscrepancy(row, stages)?.net ?? null
    default:
      return (row) => {
        const value = row[field as keyof KosztorysV2RowT]
        if (typeof value === 'number') return value
        // An empty cell is an absence, not a key: null, which sortRows sinks under both directions,
        // matching the „—" these cells render. Coercing it to `''` instead would do two kinds of
        // damage — commentless pozycje at the TOP of „Komentarz" (asc), and, since a cleared numeric
        // cell writes null through the grid's `Column<number|null>`, a string standing next to
        // numbers drops the WHOLE column into localeCompare, ordering „Przedmiar" as text („10"
        // before „9").
        return value == null || value === '' ? null : String(value)
      }
  }
}

// A column sort survives the column leaving the grid — e.g. sorting by „Pozostało brutto", then
// flipping the money axis to Netto, which drops every brutto column. The sort's own SortHeader (the
// only control that clears it) leaves with the column, yet the sort state lingers: rows stay in an
// order tied to a header that is gone, and row-reorder actions stay disabled with no way to re-enable
// them (EX-486). Reconcile the stored sort against the set of field ids that actually render, so a
// sort whose column is no longer present resolves to "no sort".
export function reconcileSort<SortT extends { field: string }>(
  sort: SortT | null,
  renderedFieldIds: Set<string>,
): SortT | null {
  return sort && renderedFieldIds.has(sort.field) ? sort : null
}
