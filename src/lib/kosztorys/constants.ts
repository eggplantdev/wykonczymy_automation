import type { CostVariantT, StageKeyT } from '@/types/kosztorys'

// Default subcontractor markup coefficients for an investment — the single source for both the
// Payload column `defaultValue` (src/collections/investments.ts) and the query fallback
// (src/lib/queries/kosztorys.ts). A section or item may override them.
export const DEFAULT_COEFFS = { wTools: 0.65, ownTools: 0.55 } as const

// Default VAT rate for an investment without one, stored as a fraction (0.08 = 8%) — the single
// source for both the Payload column `defaultValue` (src/collections/investments.ts) and the query
// fallback (src/lib/queries/kosztorys.ts). Prices are netto; brutto = net × (1 + vatRate).
export const DEFAULT_VAT = 0.08

// Unit (j.m.) combobox: suggestions cover ~97% of the real data; the cell stays creatable, so any
// custom unit is still enterable. DEFAULT_UNIT pre-fills every new item so no row lands blank.
export const UNIT_SUGGESTIONS = ['m²', 'szt', 'mb', 'kpl', 'pkt'] as const
export const DEFAULT_UNIT = 'szt'

// Placeholder description pre-filled on every new position so a fresh row reads as an item to rename
// rather than a blank line. Persisted server-side (add/insert actions) and mirrored optimistically.
export const DEFAULT_ITEM_DESCRIPTION = 'Nowa praca'

// Default values for a new section — the single source. addSectionAction and the empty-editor seed
// import these for the server-side create; the optimistic row is built from them client-side.
export const NEW_SECTION_DEFAULTS = {
  name: 'Nowa sekcja',
  defaultCostVariant: 'w_tools',
} as const satisfies { name: string; defaultCostVariant: CostVariantT }

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

// The editable stage-qty field key for a stage id (the row's `stage_<id>`). Lives here beside the
// prefix that defines it — every row/column/settlement module keys stage cells through this one
// function, so its home is the namespace, not v2-rows.
export function stageKey(stageId: number): StageKeyT {
  return `${STAGE_QTY_PREFIX}${stageId}`
}

// Column ids for the per-stage value columns. Deliberately NOT under STAGE_QTY_PREFIX: that prefix
// means "an editable qty field on the row", so a value column wearing it would reach diffRow, which
// would parse `Number('ValueNet_7')` → NaN into a save against a nonexistent stage. Kept beside the
// groups so the namespace, its group, and its label are decided in one place.
export function stageValueNetKey(stageId: number): string {
  return `${STAGE_VALUE_NET_COLUMN_GROUP}_${stageId}`
}

export function stageValueGrossKey(stageId: number): string {
  return `${STAGE_VALUE_GROSS_COLUMN_GROUP}_${stageId}`
}

export function stageValuePercentKey(stageId: number): string {
  return `${STAGE_VALUE_PERCENT_COLUMN_GROUP}_${stageId}`
}
