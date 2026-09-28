import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// The totals that only mean something once an etap has an entry. „Pozostało" is deliberately not
// here: it reads the whole przedmiar as outstanding before any work, which is a real figure, and the
// owner hides it by choice, not by data (owner, 2026-09-28). Kwota rabatu belongs: it is computed off
// the executed quantity, so before any work it reads 0 zł on every row.
const SETTLEMENT_TOTAL_COLUMNS = [
  'stageQtySum',
  'net',
  'gross',
  'donePercent',
  'discountAmount',
  'discountAmountGross',
] as const

// `!== 0`, not `> 0`: a negative quantity is a correction someone typed, and it is an entry. A row
// missing the key counts as empty, so an etap nobody can show a number for stays off the document.
export function stagesWithEntries(
  rows: readonly KosztorysV2RowT[],
  stages: readonly KosztorysStageT[],
): KosztorysStageT[] {
  return stages.filter((stage) => rows.some((row) => (row[stageKey(stage.id)] ?? 0) !== 0))
}

// Full column ids, never the picker's group keys: the group collapses every etap into one entry, so
// subtracting it would take the filled etapy off the document with the empty ones.
//
// Callers pass the UNFILTERED rows. Computed over what „Pokaż wszystkie pozycje" currently leaves on
// screen, a column would appear and vanish as the investor flips that switch.
//
// `alsoFilled` names etapy filled somewhere the rows can't show — a past version's grid, whose rows
// predate the pomiar that is being compared against it.
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
