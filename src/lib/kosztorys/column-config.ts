import {
  STAGES_COLUMN_GROUP,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_PERCENT_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

// Grid column labels — the single source for both the header and the column picker, so a rename
// can't leave the two disagreeing about what a column is called.
export const COLUMN_LABELS: Record<string, string> = {
  actions: 'Akcje',
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
  note: 'Komentarz',
}

// Which side of the netto/brutto pair a money column reports, keyed by the picker's toggleKey
// (`stageValueNet`, never `stageValueNet_7`) so the per-stage namespace collapses to one entry and no
// stage id enters the map — the same ghost-id reasoning as the picker groups (constants.ts). A column
// absent from this map is neutral: axisAllows fails open, so a forgotten tag shows a column, never hides one.
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

// Context that survives every reading mode: row identity + Pomiar z natury (the execution total) +
// the row-actions column, so switching Praca/Postęp never yanks them. Layer-neutral is orthogonal to
// the hide picker — a user can still hide any of these explicitly; this only keeps the *axis* from
// dropping them. Mirrors how AXIS_EXEMPT_COLUMNS layers policy over COLUMN_MONEY_AXIS.
export const LAYER_NEUTRAL_COLUMNS: ReadonlySet<string> = new Set([
  'actions',
  'sectionName',
  'description',
  'stageQtySum',
  // Komentarz (sheet col T): annotation that reads the same in Praca and Postęp, so the layer axis
  // must not drop it — same reasoning as `description`.
  'note',
])

// `price` is the only editable money cell — the owner types prices while reading brutto, so the mode
// must never take it away. It stays tagged `net` above because it IS a netto figure; the exemption is
// policy layered on the tag.
export const AXIS_EXEMPT_COLUMNS: ReadonlySet<string> = new Set(['price'])

// What a client may see on the share view — an ALLOWLIST, keyed by toggleKey like the maps above.
// Allowlist, not a denylist: a column added later is invisible to clients until someone puts it here,
// so the disclosure decision is forced at definition time rather than discovered as a leak.
//
// Its reach is column IDENTITY, not price plane. `price`/`net`/`gross` are allowlisted and compute at
// whatever `view` the caller passes, so this set drops the subcontractor-only columns (`priceMode`,
// `priceCoeff`) but does NOT by itself keep a subcontractor figure off the page. The locks that do:
// the client payload carries no coefficients or overrides at all, and `toClientView` pins view
// 'client' as a literal.
export const CLIENT_VISIBLE_COLUMNS: ReadonlySet<string> = new Set([
  'sectionName',
  'description',
  'plannedQty',
  'stageQtySum',
  'unit',
  'price',
  'priceGross',
  'discountType',
  'discountValue',
  'discountAmount',
  'discountAmountGross',
  'plannedNet',
  'plannedGross',
  'net',
  'gross',
  'remaining',
  'remainingGross',
  // No `note`: the sheet's „komentarz" is owner-authored internal free text (owner ruling,
  // 2026-07-20) — the client DTO drops it too, so this is the matching half of that decision.
  STAGES_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_PERCENT_COLUMN_GROUP,
  'donePercent',
])

// The stage axis triples the grid's stage block, and brutto per stage is the least-read of the three
// — derivable from the netto beside it at a fixed rate. Declared here rather than seeded into the
// stored map; useHiddenColumns owns that argument.
export const DEFAULT_HIDDEN_COLUMNS: ReadonlySet<string> = new Set([STAGE_VALUE_GROSS_COLUMN_GROUP])
