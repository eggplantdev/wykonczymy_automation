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
  measuredQty: 'Pomiar',
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
  stages: 'Etapy',
}

// All stage columns hide under ONE picker entry rather than one per `stage_<id>`: a row per stage is
// noise, and it keeps stage ids out of the visibility map — Postgres can reissue a deleted stage's
// id, and a new stage inheriting the dead one's hidden state would be a ghost.
export const STAGES_COLUMN_GROUP = 'stages'

// Columns the picker must never offer: without an Opis prac a row is unidentifiable. The actions
// column isn't listed because it never enters the toggleable set.
export const NON_HIDEABLE_COLUMNS: ReadonlySet<string> = new Set(['description'])
