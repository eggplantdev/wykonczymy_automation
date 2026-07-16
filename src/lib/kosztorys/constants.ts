import type { CostVariantT } from '@/types/kosztorys'

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

// Default values for a new section — the single source. addSectionAction and the empty-editor seed
// import these for the server-side create; the optimistic row is built from them client-side.
export const NEW_SECTION_DEFAULTS = {
  name: 'Nowa sekcja',
  defaultCostVariant: 'w_tools',
} as const satisfies { name: string; defaultCostVariant: CostVariantT }

// Grid column labels — the single source for both the header and the column picker, so a rename
// can't leave the two disagreeing about what a column is called.
export const COLUMN_LABELS: Record<string, string> = {
  sectionName: 'Sekcja',
  description: 'Opis prac',
  plannedQty: 'Przedmiar',
  stageQtySum: 'Pomiar',
  unit: 'J.m.',
  priceMode: 'Źródło ceny wykonawcy',
  priceCoeff: 'Mnożnik',
  price: 'Cena j.m. netto',
  priceGross: 'Cena j.m. brutto',
  discountType: 'Rabat',
  discountValue: 'Rabat wart.',
  discountAmount: 'Rabat kwota netto',
  discountAmountGross: 'Rabat kwota brutto',
  plannedNet: 'Wartość przedmiaru netto',
  plannedGross: 'Wartość przedmiaru brutto',
  net: 'Netto',
  gross: 'Brutto',
  remaining: 'Pozostało netto',
  remainingGross: 'Pozostało brutto',
  stages: 'Etapy — ilość',
  stageValueNet: 'Etapy — kwota netto',
  stageValueGross: 'Etapy — kwota brutto',
  stageValuePercent: 'Etapy — % wykonania',
  donePercent: '% wykonania',
}

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

// Which side of the netto/brutto pair a money column reports, keyed by the picker's toggleKey
// (`stageValueNet`, never `stageValueNet_7`) so the per-stage namespace collapses to one entry and no
// stage id enters the map — the same ghost-id reasoning as the picker groups above. A column absent
// from this map is neutral: axisAllows fails open, so a forgotten tag shows a column, never hides one.
export const COLUMN_MONEY_AXIS: Record<string, 'net' | 'gross'> = {
  price: 'net',
  priceGross: 'gross',
  discountAmount: 'net',
  discountAmountGross: 'gross',
  plannedNet: 'net',
  plannedGross: 'gross',
  net: 'net',
  gross: 'gross',
  remaining: 'net',
  remainingGross: 'gross',
  [STAGE_VALUE_NET_COLUMN_GROUP]: 'net',
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'gross',
}

// Which reading of stage progress a column is — money or percentage. Same toggleKey keying and
// fail-open contract as COLUMN_MONEY_AXIS above. `stageValuePercent` is deliberately absent from
// COLUMN_MONEY_AXIS: a percentage is the same number netto or brutto, so it survives every axis.
// The per-row `donePercent` is untagged too — it is the headline figure, not a mode's alternative.
export const COLUMN_PROGRESS_DISPLAY: Record<string, 'values' | 'percent'> = {
  [STAGE_VALUE_NET_COLUMN_GROUP]: 'values',
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'values',
  [STAGE_VALUE_PERCENT_COLUMN_GROUP]: 'percent',
}

// The grid's fourth reading axis: which layer of the table a column belongs to — the working columns
// (the offer: Przedmiar, ceny, rabat, Wartość przedmiar, Netto/Brutto, etapy-ilość) or the progress
// tracker (per-etap wartości, % wykonania, Pozostało). Only the progress side is tagged; every
// untagged column that isn't in LAYER_NEUTRAL_COLUMNS counts as "work" — that split is what lets the
// "Postęp" mode hide the untagged work columns (layer.ts derives all three buckets from this one map).
export const COLUMN_LAYER: Record<string, 'work' | 'progress'> = {
  [STAGE_VALUE_NET_COLUMN_GROUP]: 'progress',
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'progress',
  [STAGE_VALUE_PERCENT_COLUMN_GROUP]: 'progress',
  donePercent: 'progress',
  remaining: 'progress',
  remainingGross: 'progress',
}

// Always-visible context: identity that names the row plus Pomiar z natury (the execution total), so
// they survive every layer mode — the way AXIS_EXEMPT_COLUMNS layers policy over COLUMN_MONEY_AXIS.
export const LAYER_NEUTRAL_COLUMNS: ReadonlySet<string> = new Set([
  'sectionName',
  'description',
  'stageQtySum',
])

// `price` is the only editable money cell — the owner types prices while reading brutto, so the mode
// must never take it away. It stays tagged `net` above because it IS a netto figure; the exemption is
// policy layered on the tag, the way NON_HIDEABLE_COLUMNS layers on COLUMN_LABELS.
export const AXIS_EXEMPT_COLUMNS: ReadonlySet<string> = new Set(['price'])

// Without an Opis prac a row is unidentifiable, so the picker must never offer to hide it. The
// actions column isn't listed because it never enters the toggleable set.
export const NON_HIDEABLE_COLUMNS: ReadonlySet<string> = new Set(['description'])

// The stage axis triples the grid's stage block, and brutto per stage is the least-read of the three
// — derivable from the netto beside it at a fixed rate. Declared here rather than seeded into the
// stored map; useHiddenColumns owns that argument.
export const DEFAULT_HIDDEN_COLUMNS: ReadonlySet<string> = new Set([STAGE_VALUE_GROSS_COLUMN_GROUP])
