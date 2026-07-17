import type { StageKeyT } from '@/types/kosztorys'

// The stage-column key namespace: the string prefixes each stage axis lives under, and the builders
// that turn a stage id into a concrete column key. One home so the prefix, its group, and its key
// builder are decided together — every row/column/settlement module keys stage cells through these.

// Each stage axis hides under ONE picker entry rather than one per `stage_<id>`: a row per stage is
// noise, and it keeps stage ids out of the visibility map — Postgres can reissue a deleted stage's
// id, and a new stage inheriting the dead one's hidden state would be a ghost. Three groups, so the
// qty axis and each value axis hide independently.
export const STAGES_COLUMN_GROUP = 'stages'
export const STAGE_VALUE_NET_COLUMN_GROUP = 'stageValueNet'
export const STAGE_VALUE_GROSS_COLUMN_GROUP = 'stageValueGross'
export const STAGE_VALUE_PERCENT_COLUMN_GROUP = 'stageValuePercent'

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

export function stageValuePercentKey(stageId: number): string {
  return `${STAGE_VALUE_PERCENT_COLUMN_GROUP}_${stageId}`
}
