import type { KosztorysItemT, PriceSourceT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

// Literal rather than `keyof ViewPricingT` so a computed-key write still type-checks against the row.
export const OVERRIDE_FIELDS = {
  w_tools: 'wToolsOverrideValue',
  own_tools: 'ownToolsOverrideValue',
} as const satisfies Record<ToolPlaneT, keyof ViewPricingT>

export const OVERRIDE_COEFF_FIELDS = {
  w_tools: 'wToolsOverrideCoeff',
  own_tools: 'ownToolsOverrideCoeff',
} as const satisfies Record<ToolPlaneT, keyof ViewPricingT>

// Array order is the pickers' display order.
export const TOOL_PLANES = ['w_tools', 'own_tools'] as const satisfies readonly ToolPlaneT[]

export const PRICE_SOURCES = ['auto', 'coeff', 'amount'] as const satisfies readonly PriceSourceT[]

// `ownTools` is not an independent rate in the owner's sheet: it is the w-tools rate less 15%
// (`=R−R*0,15`), so 0.65 × 0.85 = 0.5525 against the client price.
export const DEFAULT_COEFFS = { wTools: 0.65, ownTools: 0.5525 } as const

export const DEFAULT_VAT = 0.08

export const UNIT_SUGGESTIONS = ['m²', 'szt', 'mb', 'kpl', 'pkt'] as const

export const DEFAULT_SECTION_NAME = 'Nowa sekcja'

export const IDENTITY_COLUMN_ID = 'description'

export const NO_AI_DRAFT = {
  aiPlannedQty: null,
  aiMissingData: null,
  aiAssumptions: null,
  aiNewInformation: null,
  aiRecheck: false,
} as const satisfies Required<
  Pick<
    KosztorysItemT,
    'aiPlannedQty' | 'aiMissingData' | 'aiAssumptions' | 'aiNewInformation' | 'aiRecheck'
  >
>
