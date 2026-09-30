import type { PriceSourceT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

// „Cena j.m." and „Źródło" are two columns over one field, and both have to agree on which. Literal
// rather than `keyof ViewPricingT` so a computed-key write still type-checks against the row.
export const OVERRIDE_FIELDS = {
  w_tools: 'wToolsOverrideValue',
  own_tools: 'ownToolsOverrideValue',
} as const satisfies Record<ToolPlaneT, keyof ViewPricingT>

// The multiplier half of the same answer (EX-865). Beside OVERRIDE_FIELDS rather than folded into
// it: a reader asking „which column holds this plane's kwota" must not have to also decide which of
// two kinds it is looking at — `priceSourceOf` is the one place that decides.
export const OVERRIDE_COEFF_FIELDS = {
  w_tools: 'wToolsOverrideCoeff',
  own_tools: 'ownToolsOverrideCoeff',
} as const satisfies Record<ToolPlaneT, keyof ViewPricingT>

// Array order is the pickers' display order.
export const TOOL_PLANES = ['w_tools', 'own_tools'] as const satisfies readonly ToolPlaneT[]

export const PRICE_SOURCES = ['auto', 'coeff', 'amount'] as const satisfies readonly PriceSourceT[]

// Default subcontractor markup coefficients for an investment — the single source for both the
// Payload column `defaultValue` (src/collections/investments.ts) and the query fallback
// (src/lib/queries/kosztorys.ts). A single pozycja may override them.
// `ownTools` is not an independent rate in the owner's sheet: it is the w-tools rate less 15%
// (`=R−R*0,15`), so 0.65 × 0.85 = 0.5525 against the client price. Rounding it to 0.55 is what
// 20260825_0 had to undo across the whole table — the derivation is the rate, not a starting point.
export const DEFAULT_COEFFS = { wTools: 0.65, ownTools: 0.5525 } as const

// Default VAT rate for an investment without one, stored as a fraction (0.08 = 8%) — the single
// source for both the Payload column `defaultValue` (src/collections/investments.ts) and the query
// fallback (src/lib/queries/kosztorys.ts). Prices are netto; brutto = net × (1 + vatRate).
export const DEFAULT_VAT = 0.08

// Unit (j.m.) combobox: suggestions cover ~97% of the real data; the cell stays creatable, so any
// custom unit is still enterable.
export const UNIT_SUGGESTIONS = ['m²', 'szt', 'mb', 'kpl', 'pkt'] as const

// Placeholder name pre-filled on every new section — the single source. createSection writes it
// server-side; the optimistic section meta mirrors it client-side.
export const DEFAULT_SECTION_NAME = 'Nowa sekcja'

// The grid's identity column. Every synthetic row (the „Razem" band and both section bands) puts its
// caption here instead of a figure, so the three cells must agree on which column that is.
export const IDENTITY_COLUMN_ID = 'description'
