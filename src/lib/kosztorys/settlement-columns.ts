import { rowPlannedDiscountForView } from '@/lib/kosztorys/calc'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// „Pozostało" is not here, because the worker's document keeps it from day one — his whole przedmiar IS outstanding work.
const SETTLEMENT_TOTAL_COLUMNS = [
  'stageQtySum',
  'net',
  'gross',
  'donePercent',
  'plannedDonePercent',
  'discountAmount',
  'discountAmountGross',
] as const

const INVESTOR_OFFER_PHASE_COLUMNS = [
  'remaining',
  'remainingGross',
  'currentPlannedQty',
  'currentPlannedNet',
  'currentPlannedGross',
] as const

// a negative quantity is a correction someone typed, and it is an entry.
export function stagesWithEntries(
  rows: readonly KosztorysV2RowT[],
  stages: readonly KosztorysStageT[],
): KosztorysStageT[] {
  return stages.filter((stage) => rows.some((row) => (row[stageKey(stage.id)] ?? 0) !== 0))
}

// Computed over what „Pokaż wszystkie pozycje" currently leaves on screen, a column would appear and
// vanish as the investor flips that switch.
export function emptySettlementColumnIds(
  rows: readonly KosztorysV2RowT[],
  stages: readonly KosztorysStageT[],
  alsoFilled: ReadonlySet<number> = new Set(),
): ReadonlySet<string> {
  const filled = new Set([
    ...stagesWithEntries(rows, stages).map((stage) => stage.id),
    ...[...alsoFilled].filter((id) => stages.some((stage) => stage.id === id)),
  ])
  const empty = new Set<string>()
  for (const stage of stages) {
    if (filled.has(stage.id)) continue
    empty.add(stageKey(stage.id))
    empty.add(stageValueNetKey(stage.id))
    empty.add(stageValueGrossKey(stage.id))
  }
  if (filled.size === 0) for (const id of SETTLEMENT_TOTAL_COLUMNS) empty.add(id)
  return empty
}

// One predicate for the „— po rabacie" header suffix and the empty rabat-on-przedmiar column, so a
// suffixed header never sits beside a dropped column or the reverse.
export function hasPlannedDiscount(rows: readonly KosztorysV2RowT[]): boolean {
  return rows.some((row) => rowPlannedDiscountForView(row, 'client') !== 0)
}

export function investorEmptyColumnIds(
  rows: readonly KosztorysV2RowT[],
  stages: readonly KosztorysStageT[],
  alsoFilled: ReadonlySet<number> = new Set(),
): ReadonlySet<string> {
  const empty = new Set(emptySettlementColumnIds(rows, stages, alsoFilled))
  if (empty.has('stageQtySum')) for (const id of INVESTOR_OFFER_PHASE_COLUMNS) empty.add(id)
  if (!hasPlannedDiscount(rows)) {
    empty.add('plannedDiscountAmount')
    empty.add('plannedDiscountAmountGross')
  }
  return empty
}
