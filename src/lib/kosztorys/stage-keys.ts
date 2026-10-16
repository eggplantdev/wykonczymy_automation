import type { StageKeyT } from '@/lib/kosztorys/types'

// Each stage axis hides under ONE picker entry rather than one per `stage_<id>`: it keeps stage ids
// out of the visibility map — Postgres can reissue a deleted stage's id, and a new stage inheriting
// the dead one's hidden state would be a ghost.
export const STAGES_COLUMN_GROUP = 'stages'
export const STAGE_VALUE_NET_COLUMN_GROUP = 'stageValueNet'
export const STAGE_VALUE_GROSS_COLUMN_GROUP = 'stageValueGross'

// diffRow (v2-rows.ts) classifies every key on the row by it, so it decides what gets saved as stage
// progress; the two value namespaces below are defined against it and must never collide with or
// prefix it.
export const STAGE_QTY_PREFIX = 'stage_'

export function stageKey(stageId: number): StageKeyT {
  return `${STAGE_QTY_PREFIX}${stageId}`
}

export function stageValueNetKey(stageId: number): string {
  return `${STAGE_VALUE_NET_COLUMN_GROUP}_${stageId}`
}

export function stageValueGrossKey(stageId: number): string {
  return `${STAGE_VALUE_GROSS_COLUMN_GROUP}_${stageId}`
}

// A key from the WRONG namespace must resolve to null, not to a number — `Number('Gross_7')` is NaN
// but `Number('')` is 0, so a bare Number() on a mis-routed key would silently name etap 0.
function stageIdFromPrefixedKey(key: string, prefix: string): number | null {
  if (!key.startsWith(prefix)) return null
  const rest = key.slice(prefix.length)
  return /^\d+$/.test(rest) ? Number(rest) : null
}

export function stageIdFromQtyKey(key: string): number | null {
  return stageIdFromPrefixedKey(key, STAGE_QTY_PREFIX)
}

export function stageIdFromValueNetKey(key: string): number | null {
  return stageIdFromPrefixedKey(key, `${STAGE_VALUE_NET_COLUMN_GROUP}_`)
}

export function stageIdFromValueGrossKey(key: string): number | null {
  return stageIdFromPrefixedKey(key, `${STAGE_VALUE_GROSS_COLUMN_GROUP}_`)
}

export function stageGroupOfKey(columnId: string): string | null {
  if (stageIdFromValueNetKey(columnId) !== null) return STAGE_VALUE_NET_COLUMN_GROUP
  if (stageIdFromValueGrossKey(columnId) !== null) return STAGE_VALUE_GROSS_COLUMN_GROUP
  return stageIdFromQtyKey(columnId) !== null ? STAGES_COLUMN_GROUP : null
}

export function stageIdOfKey(columnId: string): number | null {
  return (
    stageIdFromQtyKey(columnId) ??
    stageIdFromValueNetKey(columnId) ??
    stageIdFromValueGrossKey(columnId)
  )
}
