import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_PERCENT_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

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
