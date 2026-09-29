import type { StageKeyT } from '@/lib/kosztorys/types'

// One home for the stage-column key namespace, so a prefix, its group and its key builder are
// decided together — every row/column/settlement module keys stage cells through these.

// Each stage axis hides under ONE picker entry rather than one per `stage_<id>`: a row per stage is
// noise, and it keeps stage ids out of the visibility map — Postgres can reissue a deleted stage's
// id, and a new stage inheriting the dead one's hidden state would be a ghost. Three groups, so the
// qty axis and both value axes hide independently.
export const STAGES_COLUMN_GROUP = 'stages'
export const STAGE_VALUE_NET_COLUMN_GROUP = 'stageValueNet'
export const STAGE_VALUE_GROSS_COLUMN_GROUP = 'stageValueGross'

// The qty axis's prefix — the one axis whose key IS a row field. diffRow (v2-rows.ts) classifies
// every key on the row by it, so it decides what gets saved as stage progress; the two value
// namespaces below are defined against it and must never collide with or prefix it.
export const STAGE_QTY_PREFIX = 'stage_'

// The editable stage-qty field key for a stage id (the row's `stage_<id>`).
export function stageKey(stageId: number): StageKeyT {
  return `${STAGE_QTY_PREFIX}${stageId}`
}

// Column ids for the per-stage value columns. Deliberately NOT under STAGE_QTY_PREFIX: that prefix
// means "an editable qty field on the row", so a value column wearing it would reach diffRow, which
// would parse `Number('ValueNet_7')` → NaN into a save against a nonexistent stage.
export function stageValueNetKey(stageId: number): string {
  return `${STAGE_VALUE_NET_COLUMN_GROUP}_${stageId}`
}

export function stageValueGrossKey(stageId: number): string {
  return `${STAGE_VALUE_GROSS_COLUMN_GROUP}_${stageId}`
}

// The inverses of the builders above, for code that receives a key and has to recover the etap it
// belongs to (column-values.ts, diffRow).
//
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

// Which stage axis a column id belongs to, or null for a column that is not per-etap at all. The
// three namespaces are mutually exclusive, so the order of these tests carries no meaning.
export function stageGroupOfKey(columnId: string): string | null {
  if (stageIdFromValueNetKey(columnId) !== null) return STAGE_VALUE_NET_COLUMN_GROUP
  if (stageIdFromValueGrossKey(columnId) !== null) return STAGE_VALUE_GROSS_COLUMN_GROUP
  return stageIdFromQtyKey(columnId) !== null ? STAGES_COLUMN_GROUP : null
}
