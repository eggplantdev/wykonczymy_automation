// Flat types for the labor ("robocizna") breakdown. Relations are reduced to numeric *_id
// values — the query fetches with depth 0. costVariant = null means "inherit from the section".
// VAT is a single rate per investment (KosztorysTreeT.vatRate), not per section/item;
// in S-01 it is carried as 0 (VAT arrives in S-12).

import type { STAGE_QTY_PREFIX } from '@/lib/kosztorys/stage-keys'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

export type DiscountTypeT = 'percent' | 'amount'
// Per-investment global discount over the whole kosztorys. type null = none (per-item discounts
// apply). When set, per-item discounts are overridden and this is subtracted once from the executed
// total. Same two modes as the per-item rabat: percent = percentage points, amount = PLN (netto).
export type GlobalDiscountT = { type: DiscountTypeT | null; value: number }
export type CostVariantT = 'w_tools' | 'own_tools'
// Per-item subcontractor price override: 'coeff' = client × value (tracks the client
// price), 'amount' = flat frozen amount, null = derive from the effective coefficient.
export type SubcontractorOverrideTypeT = 'coeff' | 'amount'

export type KosztorysSectionT = {
  id: number
  name: string
  displayOrder: number
  defaultCostVariant: CostVariantT
  // null = inherit the global coefficient from the investment.
  wToolsCoeff: number | null
  ownToolsCoeff: number | null
}

export type KosztorysItemT = {
  id: number
  sectionId: number
  displayOrder: number
  description: string | null
  unit: string | null
  plannedQty: number
  discountType: DiscountTypeT | null
  discountValue: number
  clientPrice: number
  wToolsOverrideType: SubcontractorOverrideTypeT | null
  wToolsOverrideValue: number
  ownToolsOverrideType: SubcontractorOverrideTypeT | null
  ownToolsOverrideValue: number
  costVariant: CostVariantT | null
  hiddenInExport: boolean
  note: string | null
}

// Item autosave patch = the subset of fields editable in the grid (excluding id/sectionId/displayOrder).
// Single source of truth: imported both by the pure core (v2-rows diffRow/RowDiffT) and
// by the server action updateItemFieldAction (its zod validation is derived from this shape).
export type ItemPatchT = Partial<
  Pick<
    KosztorysItemT,
    | 'description'
    | 'unit'
    | 'plannedQty'
    | 'discountType'
    | 'discountValue'
    | 'clientPrice'
    | 'wToolsOverrideType'
    | 'wToolsOverrideValue'
    | 'ownToolsOverrideType'
    | 'ownToolsOverrideValue'
    | 'costVariant'
    | 'hiddenInExport'
    | 'note'
  >
>

// Global (per-investment) subcontractor markup coefficients; carried through the tree.
export type KosztorysGlobalCoeffsT = { wTools: number; ownTools: number }

// Minimal shape for deriving the view price — KosztorysV2RowT satisfies it
// (KosztorysItemT + denormalized section and global coefficients).
export type ViewPricingT = KosztorysItemT & {
  // Denormalized: the investment's global discount is set — per-item discounts stop applying
  // (applyDiscount returns gross), the global discount is subtracted once at the total level.
  globalDiscountActive: boolean
  sectionWToolsCoeff: number | null
  sectionOwnToolsCoeff: number | null
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
}

export type KosztorysStageT = {
  id: number
  ordinal: number
  label: string | null
}

export type StageProgressT = {
  itemId: number
  stageId: number
  qtyDone: number
}

export type KosztorysTreeT = {
  sections: (KosztorysSectionT & { items: KosztorysItemT[] })[]
  stages: KosztorysStageT[]
  progress: StageProgressT[]
  globalCoeffs: KosztorysGlobalCoeffsT
  // A single VAT rate per investment — carried through the tree (like globalCoeffs), denormalized onto each row.
  vatRate: number
  // A single global discount per investment — its `active` flag is denormalized onto each row (see
  // KosztorysV2RowBaseT.globalDiscountActive), the amount is subtracted once at the total level.
  globalDiscount: GlobalDiscountT
  // Server-supplied change token = investment.updatedAt (ISO). A restore always bumps it (its final
  // payload.update stamps updatedAt), so the editor shell can key its restore remount on this token
  // changing rather than on the `tree` prop's object identity, which router.refresh reshapes every time.
  revision: string
}

// --- v2 variant (react-datasheet-grid): a flat row with stages flattened
// into stage_<stageId> keys so that keyColumn maps 1:1. ---
export type KosztorysV2RowBaseT = KosztorysItemT & {
  sectionName: string
  // Denormalized investment VAT rate (one for the whole kosztorys) — gross = net × (1 + vatRate).
  vatRate: number
  globalDiscountActive: boolean
  sectionDefaultCostVariant: CostVariantT
  // Denormalized coefficients for deriving the subcontractor price on the row (ViewPricingT).
  sectionWToolsCoeff: number | null
  sectionOwnToolsCoeff: number | null
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
}

// Keyed off the constant so the type and diffRow's runtime `startsWith` can never drift apart.
// `import type` on a value import keeps this erased — no runtime cycle with constants.ts, which
// imports types from here.
export type StageKeyT = `${typeof STAGE_QTY_PREFIX}${number}`

export type KosztorysV2RowT = KosztorysV2RowBaseT & {
  [stageKey: StageKeyT]: number
}

// --- The client-facing projection (S-11 / EX-532) ---
//
// The leak boundary. These types carry NO costVariant, NO coefficients and NO *Override* field, so
// the inputs a subcontractor price is derived from never enter the client render's module graph.
// What the client receives is the client-price plane only; `toClientView` computes every money
// figure at the literal view 'client', so a subcontractor price is not filtered out — it is never
// computed. Adding a field here is the one place to ask "may the client see this?".

export type ClientKosztorysRowT = {
  id: number
  sectionId: number
  sectionName: string
  description: string | null
  unit: string | null
  plannedQty: number
  clientPrice: number
  discountType: DiscountTypeT | null
  discountValue: number
  note: string | null
  // Per-etap recorded quantity, keyed by stage id — the sheet's D:M. Pomiar z natury is their sum,
  // derived at render like every other figure, never carried as a second copy.
  stageQty: Record<number, number>
}

// A section's slice of the executed work, for the pie: the same figures the editor's section panel
// shows, weighted at the client price.
export type ClientSectionShareT = {
  sectionId: number
  sectionName: string
  net: number
  share: number
}

// The footer block (sheet Podsumowanie): the work waterfall plus the materials and deposit lines the
// client is billed. Server-computed — these cross the kosztorys/transactions boundary, which the
// row plane cannot see. Deliberately carries NO reconciliation verdict: that is the owner's
// internal check against the transaction ledger (EX-535) and must never reach a client.
export type ClientKosztorysTotalsT = {
  sumaPracNet: number
  discountNet: number
  robociznaNet: number
  materialyNet: number
  materialyBreakdown: MaterialyBreakdownRowT[]
  depositsNet: number
  // Suma transzy: value executed per etap, in `stages` order.
  stageTotals: { stageId: number; net: number }[]
}

export type ClientKosztorysViewT = {
  investmentName: string
  vatRate: number
  // Per-item discounts are overridden while this is on — the grid drops those columns, exactly as
  // the editor does, and the discount lands once on the footer's „Rabat" line.
  globalDiscountActive: boolean
  stages: KosztorysStageT[]
  rows: ClientKosztorysRowT[]
  sections: ClientSectionShareT[]
  totals: ClientKosztorysTotalsT
}

export type SectionSubtotalT = {
  sectionId: number
  sectionName: string
  net: number // executed (the sheet's T), at the active price view — a MONEY figure
  plannedNet: number // offered (the sheet's S), at the active price view — a MONEY figure
  // Σ per-item rabat actually taken on the executed qty, at the active price view — a MONEY figure.
  // 0 when the global discount is active (it overrides per-item rabat). Lets the totals show one
  // explicit „Rabat" figure without re-deriving it from pre/post-rabat totals.
  discount: number
  // 0..1, the section's share of all sections' executed value — weighted at the CLIENT price only, so
  // like completionRatio it is a STRUCTURE figure that must not move with the price view.
  share: number
  // Completion (executed ÷ offered) weighted at the CLIENT price only — a PROGRESS figure, so it
  // must not move with the price view. `null` when there is no offer to divide by.
  completionRatio: number | null
  itemCount: number
}
