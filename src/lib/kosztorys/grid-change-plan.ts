import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { FieldChangeT, StageChangeT } from '@/lib/kosztorys/undo-coalesce'
import { diffRow } from '@/lib/kosztorys/v2-rows'
import type { ItemPatchT, KosztorysV2RowT } from '@/lib/kosztorys/types'

export type GridChangePlanT = {
  fieldChanges: FieldChangeT[]
  stageChanges: StageChangeT[]
  changedById: Map<number, KosztorysV2RowT>
}

export function planGridChanges(
  next: readonly KosztorysV2RowT[],
  prevById: ReadonlyMap<number, KosztorysV2RowT>,
): GridChangePlanT {
  const plan: GridChangePlanT = {
    fieldChanges: [],
    stageChanges: [],
    changedById: new Map(),
  }
  for (const row of next) {
    const prev = prevById.get(row.id)
    if (!prev) continue
    const diff = diffRow(prev, row)
    if (diff.itemPatch) {
      for (const field of Object.keys(diff.itemPatch) as (keyof ItemPatchT)[]) {
        plan.fieldChanges.push({
          id: row.id,
          field,
          before: prev[field as keyof KosztorysV2RowT],
          after: row[field as keyof KosztorysV2RowT],
        })
      }
    }
    for (const sc of diff.stageChanges ?? []) {
      plan.stageChanges.push({
        id: row.id,
        stageId: sc.stageId,
        before: Number(prev[stageKey(sc.stageId)]) || 0,
        after: sc.qty,
      })
    }
    if (diff.itemPatch || diff.stageChanges) plan.changedById.set(row.id, row)
  }
  return plan
}
