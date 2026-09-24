import {
  priceSourceOf,
  rowDiscountForView,
  rowDoneFraction,
  rowPlannedNetForView,
  shownCoeff,
  stageValueForView,
  toGross,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import {
  measureDiscrepancy,
  rowRemainingForView,
  rowTotalQtyDone,
  rowValueForView,
} from '@/lib/kosztorys/settlement-rows'
import { stagesForView } from '@/lib/kosztorys/settlement-view'
import { planePriceKeyParts } from '@/lib/kosztorys/plane-price-keys'
import {
  stageIdFromValueGrossKey,
  stageIdFromValueNetKey,
  stageKey,
} from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT, PriceSourceT } from '@/lib/kosztorys/types'

// Rosnąco = coraz dalej od współczynnika inwestycji: auto, potem mnożnik, który wciąż chodzi za ceną,
// na końcu zamrożona kwota.
const PRICE_SOURCE_ORDER: Record<PriceSourceT, number> = { auto: 0, coeff: 1, amount: 2 }

// The wartość of one etap, as its cell computes it. The denominator is Σ etapów of the whole VIEW,
// never a narrowed list (kosztorys-v2-columns.tsx) — `rowTotalQtyDone` applies that filter itself, so
// this is handed the full `stages` array and must stay that way. An etap the view does not price has
// no value to show: null, which sortRows sinks — same answer as an id that is gone entirely.
function stageValueNetSortValue(
  row: KosztorysV2RowT,
  stageId: number,
  stages: KosztorysStageT[],
  view: PriceViewT,
): number | null {
  if (!stagesForView(stages, view).some((st) => st.id === stageId)) return null
  return stageValueForView(
    row,
    row[stageKey(stageId)] ?? 0,
    rowTotalQtyDone(row, stages, view),
    view,
  )
}

// The sort key for a grid column. Most columns in kosztorys-v2-columns.tsx are COMPUTED — their
// value is derived at render from calc/settlement, never stored on the row — so a `row[field]` read
// returns undefined for them and the sort silently no-ops (EX-487). Each computed case here composes
// the figure the same way its column renderer does; the arithmetic stays in calc/settlement, this
// only picks which composition, so the two cannot drift on the maths. A real row field falls through
// to the default. `null` — a figure with no denominator (remaining with no przedmiar), a key whose
// etap is gone, or simply an empty cell — is returned verbatim, and sortRows sinks it to the bottom
// in both directions.
export function columnSortValue(
  row: KosztorysV2RowT,
  field: string,
  view: PriceViewT,
  stages: KosztorysStageT[],
): string | number | null {
  // Ahead of the switch: the two per-etap value namespaces carry a stage id inside the key, so no
  // exact-match case can name them. The qty axis needs nothing here — `stage_<id>` IS a row field
  // (v2-rows.ts seeds every one of them as a number), so it resolves through the default below.
  const valueNetStageId = stageIdFromValueNetKey(field)
  if (valueNetStageId !== null) return stageValueNetSortValue(row, valueNetStageId, stages, view)
  const valueGrossStageId = stageIdFromValueGrossKey(field)
  if (valueGrossStageId !== null) {
    const net = stageValueNetSortValue(row, valueGrossStageId, stages, view)
    return net === null ? null : toGross(net, row.vatRate)
  }

  // The two subcontractor-rate namespaces, for the same reason: their ids are not row fields (the
  // fields are per-plane, OVERRIDE_FIELDS), and the plane they price rides in the id now that every
  // view assembles both. Reading the ACTIVE view here would sort „bez narzędzi" by the „z
  // narzędziami" numbers — a wrong order that looks like a plausible one.
  const pricePart = planePriceKeyParts(field)
  if (pricePart !== null) {
    const { base, plane } = pricePart
    if (base === 'price') return viewPrice(row, plane)
    // `shownCoeff`, czyli dokładnie to, co widać w komórce — inaczej sortowanie malejąco wpychało
    // wiersz pokazujący mnożnik inwestycji pod wiersz pokazujący mniejszy własny. Bez mnożnika
    // („kwota stała") na końcu: kolumna czyta się jako lista „gdzie stawka chodzi za ceną", a te
    // wiersze do niej nie należą.
    if (base === 'priceCoeff') return shownCoeff(row, plane)
    // „Źródło ceny wykonawcy" ascending runs inherited → own mnożnik → hand-typed kwota: away from
    // the investment's own coefficient, which is the only question asked of that column.
    // Alphabetical would put „auto" after „kwota stała".
    return PRICE_SOURCE_ORDER[priceSourceOf(row, plane)]
  }

  switch (field) {
    // The client's own price column — the only price id left without a plane, and assembled only in
    // the client view, so `view` is the plane to read.
    case 'price':
      return viewPrice(row, view)
    case 'priceGross':
      return toGross(viewPrice(row, view), row.vatRate)
    case 'plannedNet':
      return rowPlannedNetForView(row, view)
    case 'plannedGross':
      return toGross(rowPlannedNetForView(row, view), row.vatRate)
    case 'net':
      return rowValueForView(row, stages, view)
    case 'gross':
      return toGross(rowValueForView(row, stages, view), row.vatRate)
    case 'discountAmount':
      return rowDiscountForView(row, rowTotalQtyDone(row, stages, view), view)
    case 'discountAmountGross':
      return toGross(rowDiscountForView(row, rowTotalQtyDone(row, stages, view), view), row.vatRate)
    case 'stageQtySum':
      return rowTotalQtyDone(row, stages, view)
    // By value, not by quantity: sorting a rozjazd list is triage, and „which m² gap is biggest" says
    // nothing across rows priced at 30 zł and 3000 zł. `null` on the rows that agree sinks them to the
    // bottom, which is where a work list wants them.
    case 'divergence':
      return measureDiscrepancy(row, stages)?.net ?? null
    case 'donePercent':
      return rowDoneFraction(row, rowTotalQtyDone(row, stages, view))
    case 'remaining':
      return rowRemainingForView(row, stages, view)
    case 'remainingGross':
      return toGross(rowRemainingForView(row, stages, view), row.vatRate)
    default: {
      const value = row[field as keyof KosztorysV2RowT]
      if (typeof value === 'number') return value
      // An empty cell is an absence, not a key: null, which sortRows sinks under both directions,
      // matching the „—" these cells render. Coercing it to `''` instead would do two kinds of
      // damage — commentless pozycje at the TOP of „Komentarz" (asc), and, since a cleared numeric
      // cell writes null through the grid's `Column<number|null>`, a string standing next to numbers
      // drops the WHOLE column into localeCompare, ordering „Przedmiar" as text („10" before „9").
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
