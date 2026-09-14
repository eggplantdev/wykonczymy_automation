import type { PriceViewT } from '@/lib/kosztorys/calc'
import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import { ALL_PLANE_PRICE_KEYS, planePriceKeyParts } from '@/lib/kosztorys/plane-price-keys'
import {
  STAGES_COLUMN_GROUP,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

// Grid column labels — the single source for both the header and the column picker, so a rename
// can't leave the two disagreeing about what a column is called.
export const COLUMN_LABELS: Record<string, string> = {
  actions: 'Akcje',
  sectionName: 'Sekcja',
  description: 'Opis prac',
  plannedQty: 'Przedmiar',
  stageQtySum: 'Pomiar (razem etapy)',
  // Names both sides of its subtraction in the header: the column is read at a glance, so needing a
  // tooltip to learn which two figures are being compared would defeat it.
  divergence: 'Rozjazd między arkuszem Google a apką',
  unit: 'Jednostka miary',
  priceMode: 'Źródło ceny wykonawcy',
  price: 'Cena j.m. netto',
  priceGross: 'Cena j.m. brutto',
  discountType: 'Rabat',
  discountValue: 'Rabat wart.',
  discountAmount: 'Rabat kwota netto',
  discountAmountGross: 'Rabat kwota brutto',
  plannedNet: 'Wartość przedmiaru netto',
  plannedGross: 'Wartość przedmiaru brutto',
  net: 'Razem netto',
  gross: 'Razem brutto',
  remaining: 'Pozostało netto (względem przedmiaru)',
  remainingGross: 'Pozostało brutto (względem przedmiaru)',
  stages: 'Etapy — ilość',
  stageValueNet: 'Etapy — kwota netto',
  stageValueGross: 'Etapy — kwota brutto',
  donePercent: '% wykonania (względem przedmiaru)',
  note: 'Komentarz',
}

/**
 * The two labels that mean different things per view, resolved in the same module that owns every
 * other label — otherwise the header renders a view-aware name while the column picker reads
 * `COLUMN_LABELS[id]` and the two disagree about what a column is called, which is the exact drift
 * this file exists to prevent.
 *
 * „Razem": what the client pays (post-rabat) vs what this crew is owed (rabat is a client concession
 * — calc.ts `netForQtyForView`). „Pomiar": the whole scope's executed quantity vs only this crew's
 * etapy (settlement-rows.ts `rowTotalQtyDone`).
 */
export function columnLabelForView(id: string, view: PriceViewT): string {
  // A subcontractor rate names its plane in the label, because both planes are on screen at once and
  // the picker is a flat list — „Cena j.m. netto" twice would be unreadable. Same „— <wariant>" shape as
  // „Razem netto — po rabacie" below, and built from the base entry so one rename moves both planes.
  const planePrice = planePriceKeyParts(id)
  if (planePrice !== null) {
    const { base, plane } = planePrice
    return `${COLUMN_LABELS[base] ?? id} — ${PLANE_LABELS[plane].toLowerCase()}`
  }
  const label = COLUMN_LABELS[id] ?? id
  if (id === 'net' || id === 'gross') {
    if (view === 'client') return `${label} — po rabacie`
    return `Suma etapy ${PLANE_LABELS[view].toLowerCase()} ${id === 'net' ? 'netto' : 'brutto'}`
  }
  if (id === 'stageQtySum' && view !== 'client')
    return `Pomiar (suma etapów — ${PLANE_LABELS[view].toLowerCase()})`
  return label
}

/**
 * Columns anchored to the przedmiar — visible on the client PRICE PLANE only (`view === 'client'`,
 * not the `preview` render mode). The przedmiar has no plane: it
 * is typed once per row for the WHOLE offered scope, so beside a plane-filtered pomiar it invites a
 * comparison that means nothing (one crew's numerator over everyone's denominator).
 *
 * A set applied at the selection chokepoint, not four `view === 'client' ? […] : []` wrappers in the
 * assembly: this way there is a list you can read to answer "which columns are przedmiar-anchored",
 * and a przedmiar-derived column added later is opted in here rather than silently shipping the
 * nonsense comparison because someone missed the wrapping idiom.
 */
export const PRZEDMIAR_ANCHORED_COLUMNS: ReadonlySet<string> = new Set([
  'plannedQty',
  'plannedNet',
  'plannedGross',
  'donePercent',
  'remaining',
  'remainingGross',
])

// Which side of the netto/brutto pair a money column reports, keyed by the picker's toggleKey
// (`stageValueNet`, never `stageValueNet_7`) so the per-stage namespace collapses to one entry and no
// stage id enters the map — the same ghost-id reasoning as the picker groups (stage-keys.ts). A column
// absent from this map is neutral: axisAllows fails open, so a forgotten tag shows a column, never hides one.
// The per-row `donePercent` is untagged on purpose: a percentage is the same number netto or brutto.
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

// The grid's third reading axis: which layer of the table a column belongs to — the working columns
// (the offer: Przedmiar, ceny, rabat, Wartość przedmiar, Netto/Brutto, etapy-ilość) or the progress
// tracker (per-etap wartości, % wykonania, Pozostało). Only the progress side is tagged; every
// untagged column that isn't in LAYER_NEUTRAL_COLUMNS counts as "work" — that split is what lets the
// "Postęp" mode hide the untagged work columns (layer.ts derives all three buckets from this one map).
export const COLUMN_LAYER: Record<string, 'work' | 'progress'> = {
  [STAGE_VALUE_NET_COLUMN_GROUP]: 'progress',
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'progress',
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
  // A rozjazd is a to-do about the etapy, so it belongs to the progress reading — but it is also the
  // reason to go back and fix the offer's execution record, so dropping it in „Praca" would hide the
  // work list in the mode where the fixing happens.
  'divergence',
  // Komentarz (sheet col T): annotation that reads the same in Praca and Postęp, so the layer axis
  // must not drop it — same reasoning as `description`.
  'note',
])

// Columns the picker never offers, and which therefore never answer to a hide tick. „Pozostało do
// rozliczenia" is assembled only while its own diagnostic („z pomiarem do rozpisania na etapy") is
// pressed — its visibility already IS the answer to the gesture the user just made, so a tick could
// only contradict it, and a „hidden" stored before would silently gut the filter it belongs to.
export const UNPICKABLE_COLUMNS: ReadonlySet<string> = new Set(['divergence'])

// `price` is the only editable money cell — the owner types prices while reading brutto, so the mode
// must never take it away. It stays tagged `net` above because it IS a netto figure; the exemption is
// policy layered on the tag.
// Read through basePriceKey, so both planes' „Cena j.m. netto" inherit the exemption from the one
// entry.
export const AXIS_EXEMPT_COLUMNS: ReadonlySet<string> = new Set(['price'])

// The four per-item rabat columns hidden while the global discount overrides them. Paired with
// DISCOUNT_CONDITION_IDS (row-conditions/registry.ts), which drops the matching „Problemy" entries.
export const DISCOUNT_COLUMN_IDS: ReadonlySet<string> = new Set([
  'discountValue',
  'discountType',
  'discountAmount',
  'discountAmountGross',
])

// What a client may see on the share view — an ALLOWLIST, keyed by toggleKey like the maps above.
// Allowlist, not a denylist: a column added later is invisible to clients until someone puts it here,
// so the disclosure decision is forced at definition time rather than discovered as a leak.
//
// Its reach is column IDENTITY, not price plane: `price`/`net`/`gross` are allowlisted and compute at
// whatever `view` is active, so this set does NOT by itself keep a subcontractor figure off the page.
// It is half a lock — the other half pins the plane, see `assertDisclosurePair`. (The subcontractor-
// only `priceMode` is absent here too, but that is defence in depth; it is never assembled at the
// client plane in the first place.)
//
// Written as groups because the settings dialog offers the same columns as ticks and needs headings
// for them; the allowlist below is their flattening, so a column cannot be offerable-but-barred (or
// visible-but-unhideable) — there is only one list.
export type ClientViewGroupT = {
  label: string
  keys: readonly string[]
}

export const CLIENT_VIEW_GROUPS: readonly ClientViewGroupT[] = [
  {
    label: 'Opis i ilości',
    keys: ['sectionName', 'description', 'plannedQty', 'stageQtySum', 'unit'],
  },
  {
    label: 'Ceny i rabat',
    keys: [
      'price',
      'priceGross',
      'discountType',
      'discountValue',
      'discountAmount',
      'discountAmountGross',
    ],
  },
  {
    label: 'Wartości',
    // No `note`: the sheet's „komentarz" is owner-authored internal free text (owner ruling,
    // 2026-07-20) — the client DTO drops it too, so this is the matching half of that decision.
    keys: ['plannedNet', 'plannedGross', 'net', 'gross', 'remaining', 'remainingGross'],
  },
  {
    label: 'Etapy i postęp',
    keys: [
      STAGES_COLUMN_GROUP,
      STAGE_VALUE_NET_COLUMN_GROUP,
      STAGE_VALUE_GROSS_COLUMN_GROUP,
      'donePercent',
    ],
  },
]

export const PREVIEW_VISIBLE_COLUMNS: ReadonlySet<string> = new Set(
  CLIENT_VIEW_GROUPS.flatMap((group) => group.keys),
)

// The stage axis multiplies the grid's stage block, and brutto per stage is the less-read of the pair
// — derivable from the netto beside it at a fixed rate. „Sekcja" repeats one name down every row of
// its section, which the band above the section now says once; the column stays available for
// copy/paste and sorting. Declared here rather than seeded into the stored map; useHiddenColumns
// owns that argument.
//
// Every subcontractor rate column starts hidden, in the subcontractor views too. Four rate columns
// unfurling on first load would bury the offer they qualify; switching them on is one tick in the
// picker, and the tick is what makes the reading deliberate.
export const DEFAULT_HIDDEN_COLUMNS: ReadonlySet<string> = new Set([
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  'sectionName',
  ...ALL_PLANE_PRICE_KEYS,
])
