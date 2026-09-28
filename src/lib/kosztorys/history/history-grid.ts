import { stageIdFromQtyKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import type { FieldChangeT, PastVersionT, VersionDiffT } from './types'

// The past grid carries the etapy added since as columns of its own, so a pomiar typed into one
// renders as 0 → new on the row it landed on instead of having no cell to land in.
export function historyGridTree(version: PastVersionT): KosztorysTreeT {
  return { ...version.tree, stages: [...version.tree.stages, ...version.diff.addedStages] }
}

// The etapy that hold a pomiar TODAY on a row the past grid shows. The empty-column rule reads the
// past rows, so without these a version from before any work would hide every Pomiar column — and
// with it the change the investor opened the version to see.
export function stageIdsFilledNow(diff: VersionDiffT): ReadonlySet<number> {
  const filled = new Set<number>()
  for (const { fields } of diff.changed.values()) {
    for (const change of fields) {
      if (change.field === 'stageQty' && change.after !== 0) filled.add(change.stageId)
    }
  }
  return filled
}

// Each column id IS the field it renders.
const FIELD_COLUMN_IDS: ReadonlySet<string> = new Set<FieldChangeT['field']>([
  'plannedQty',
  'price',
  'plannedNet',
  'net',
])

export function isHistoryColumn(columnId: string | undefined): columnId is string {
  if (columnId === undefined) return false
  return FIELD_COLUMN_IDS.has(columnId) || stageIdFromQtyKey(columnId) !== null
}

export function cellChange(
  diff: VersionDiffT,
  rowId: number,
  columnId: string,
): FieldChangeT | undefined {
  const fields = diff.changed.get(rowId)?.fields
  if (!fields) return undefined
  const stageId = stageIdFromQtyKey(columnId)
  if (stageId !== null) {
    return fields.find((change) => change.field === 'stageQty' && change.stageId === stageId)
  }
  return fields.find((change) => change.field === columnId)
}
