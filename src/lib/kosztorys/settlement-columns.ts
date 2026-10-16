import { stageKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// „Pozostało" is not here, because the worker's document keeps it from day one — his whole przedmiar IS outstanding work.
const SETTLEMENT_TOTAL_COLUMNS = [
  'stageQtySum',
  'net',
  'donePercent',
  'plannedDonePercent',
  'discountAmount',
] as const

const INVESTOR_OFFER_PHASE_COLUMNS = [
  'remaining',
  'currentPlannedQty',
  'currentPlannedNet',
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
  }
  if (filled.size === 0) for (const id of SETTLEMENT_TOTAL_COLUMNS) empty.add(id)
  return empty
}

export function investorEmptyColumnIds(
  rows: readonly KosztorysV2RowT[],
  stages: readonly KosztorysStageT[],
  alsoFilled: ReadonlySet<number> = new Set(),
): ReadonlySet<string> {
  const empty = new Set(emptySettlementColumnIds(rows, stages, alsoFilled))
  if (empty.has('stageQtySum')) for (const id of INVESTOR_OFFER_PHASE_COLUMNS) empty.add(id)
  return empty
}
