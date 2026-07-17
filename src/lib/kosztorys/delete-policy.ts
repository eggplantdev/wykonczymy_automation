import { stageKey } from '@/lib/kosztorys/constants'
import type { KosztorysStageT, KosztorysV2RowT } from '@/types/kosztorys'

// Client mirror of the server delete-guard predicate (removeItemAction/removeSectionAction).
// A row is "populated" iff it holds recorded stage progress (qty <> 0) — that is the only work a
// delete would destroy. Server SQL stays the authority; this only drives the pre-check + toast so a
// populated delete never optimistically vanishes. Field names must match the server predicate.
export function isRowPopulated(row: KosztorysV2RowT, stages: KosztorysStageT[]): boolean {
  return stages.some((st) => (row[stageKey(st.id)] ?? 0) !== 0)
}

// Count of a section's items in the full dataset — guards the invariant "a section has ≥1 item".
export function sectionItemCount(rows: KosztorysV2RowT[], sectionId: number): number {
  return rows.reduce((n, r) => (r.sectionId === sectionId ? n + 1 : n), 0)
}

// Item-count per section in one O(n) pass. Precompute once per render so the render-hot
// getRemovePlan is O(1) per row (a Map lookup) instead of re-scanning all rows per row — the
// per-cell sectionItemCount call made the delete plan O(n²) across the grid.
export function sectionItemCounts(rows: KosztorysV2RowT[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const r of rows) counts.set(r.sectionId, (counts.get(r.sectionId) ?? 0) + 1)
  return counts
}

export const REMOVE_BLOCK_LAST_ITEM = 'Kosztorys musi mieć co najmniej jedną pozycję'

export type ItemRemovalPlanT =
  | { kind: 'blocked'; reason: string }
  | { kind: 'cascade-section'; requiresConfirm: boolean }
  | { kind: 'remove-item'; requiresConfirm: boolean }

// planItemRemoval's decision against precomputed totals — the render-hot path passes totalRows +
// this row's section count (from sectionItemCounts) so it never rescans the dataset per cell.
// A populated row is no longer hard-blocked (EX-477): deleting recorded work is allowed behind a
// confirmation dialog, so `requiresConfirm` carries whether the caller must confirm first.
export function planItemRemovalFromCounts(
  totalRows: number,
  sectionCount: number,
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
): ItemRemovalPlanT {
  // Floor: keep ≥1 item in the whole sheet so the editor never goes fully empty. The one remaining
  // hard block — a populated final row still can't be deleted below the floor.
  if (totalRows <= 1) return { kind: 'blocked', reason: REMOVE_BLOCK_LAST_ITEM }
  const requiresConfirm = isRowPopulated(row, stages)
  // Last item in its section → cascade-delete the section so no orphaned 0-row section is left.
  if (sectionCount <= 1) return { kind: 'cascade-section', requiresConfirm }
  return { kind: 'remove-item', requiresConfirm }
}

// What deleting `row` does, given the whole sheet `rows` + `stages`. Pure so the disabled-tooltip
// reason and the delete handler share one source of truth (use-kosztorys-editor). Event-time callers
// use this directly; the render-hot path goes through planItemRemovalFromCounts + sectionItemCounts.
export function planItemRemoval(
  rows: KosztorysV2RowT[],
  row: KosztorysV2RowT,
  stages: KosztorysStageT[],
): ItemRemovalPlanT {
  return planItemRemovalFromCounts(rows.length, sectionItemCount(rows, row.sectionId), row, stages)
}
