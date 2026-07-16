// Flat types for the labor ("robocizna") breakdown. Relations are reduced to numeric *_id
// values — the query fetches with depth 0. costVariant = null means "inherit from the section".
// VAT is a single rate per investment (KosztorysTreeT.vatRate), not per section/item;
// in S-01 it is carried as 0 (VAT arrives in S-12).

import type { STAGE_QTY_PREFIX } from '@/lib/kosztorys/constants'

export type DiscountTypeT = 'percent' | 'amount'
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

export type SectionSubtotalT = {
  sectionId: number
  sectionName: string
  net: number // executed (the sheet's T)
  plannedNet: number // offered (the sheet's S)
  share: number // 0..1, share of the combined net total of all sections
  itemCount: number
}
