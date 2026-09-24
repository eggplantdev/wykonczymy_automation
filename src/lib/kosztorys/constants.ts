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

export const PLANE_LABELS: Record<ToolPlaneT, string> = {
  w_tools: 'Z narzędziami (podwykonawca)',
  own_tools: 'Bez narzędzi (pracownik)',
}

export const RATE_LABELS: Record<ToolPlaneT, string> = {
  w_tools: `Stawka ${PLANE_LABELS.w_tools.toLowerCase()}`,
  own_tools: `Stawka ${PLANE_LABELS.own_tools.toLowerCase()}`,
}

// The trzy źródła stawki wykonawcy as a runtime list plus their Polish names, in one place: the
// siatka's menu, the katalog's formularz and the zod enum behind it all branch on the same three
// values, and a fourth spelling of „własny mnożnik" is a fourth thing to keep in step. Labels name
// the ŹRÓDŁO, not the arithmetic.
export const PRICE_SOURCES = ['auto', 'coeff', 'amount'] as const satisfies readonly PriceSourceT[]

export const PRICE_SOURCE_LABELS: Record<PriceSourceT, string> = {
  auto: 'auto',
  coeff: 'własny mnożnik',
  amount: 'kwota stała',
}

// The tail a row-condition label carries when the figure it judges only exists in one view. One
// source because it is both written (the registry builds labels with it) and REMOVED again (the
// „Problemy" menu, whose heading already names the view) — two literals would drift apart silently.
export const planeViewSuffix = (plane: ToolPlaneT) =>
  ` w widoku ${PLANE_LABELS[plane].toLowerCase()}`

// The three figures of the subcontractor settlement, named once. The headline block reads them as row
// labels and the per-worker table as column headers — the same three amounts, so a reader must never
// have to work out that „Należne" and „Suma wykonanej pracy" were the same thing.
export const SUBCONTRACTOR_FIGURE_LABELS = {
  due: 'Suma wykonanej pracy',
  payouts: 'Zaliczki (wypłaty)',
  remaining: 'Pozostało do wypłaty',
} as const

// One tone for every stawka the company would not pay, on all three surfaces that judge one (cell,
// katalog share, global mnożnik) — a breach of the sufit on the first two, and on the third also a
// mnożnik of zero or below, which pays the crew nothing or less. None of them is refused, but all of
// them are what the owner scans for, and a second colour for „accepted but wrong" would only ask the
// reader to learn which red means what.
export const FLAGGED_TONE = 'text-destructive font-medium'

// Longer than toastMessage's default 2s: these fire as the user's eyes are already moving on, and
// they report a figure that was just committed.
export const NOTICE_MS = 5000

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
// custom unit is still enterable. DEFAULT_UNIT pre-fills every new item so no row lands blank.
export const UNIT_SUGGESTIONS = ['m²', 'szt', 'mb', 'kpl', 'pkt'] as const
export const DEFAULT_UNIT = 'szt'

// Placeholder description pre-filled on every new position so a fresh row reads as an item to rename
// rather than a blank line. Persisted server-side by createBlankItem and mirrored optimistically.
export const DEFAULT_ITEM_DESCRIPTION = 'Nowa praca'

// Placeholder name pre-filled on every new section — the single source. createSectionWithFirstItem
// writes it server-side; the optimistic row mirrors it client-side.
export const DEFAULT_SECTION_NAME = 'Nowa sekcja'

// The grid's identity column. Every synthetic row (the „Razem" band and both section bands) puts its
// caption here instead of a figure, so the three cells must agree on which column that is.
export const IDENTITY_COLUMN_ID = 'description'
