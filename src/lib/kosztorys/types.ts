// Flat types for the labor ("robocizna") breakdown. Relations are reduced to numeric *_id
// values — the query fetches with depth 0.
// VAT is a single rate per investment (KosztorysTreeT.vatRate), not per section/item.

import type { STAGE_QTY_PREFIX } from '@/lib/kosztorys/stage-keys'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { InvestmentFinancialsT, MaterialsBreakdownRowT } from '@/types/investment-financials'
import type { WorkerRefT } from '@/types/reference-data'
import type {
  PayoutTransactionRowT,
  DepositTransactionRowT,
  MaterialTransactionRowT,
} from '@/types/transfers'

export type DiscountTypeT = 'percent' | 'amount'
// type null = none (per-item rabaty apply). When set it overrides them and is subtracted once from
// the executed total (PLN netto). A percent rabat isn't stored here — it is a one-shot tool that
// stamps a percent into every per-item rabat (applyPercentDiscountToAllItemsAction).
export type GlobalDiscountT = { type: 'amount' | null; value: number }
export type KosztorysSectionT = {
  id: number
  name: string
  displayOrder: number
  // Palette key (src/lib/kosztorys/section-colors.ts); null = unpinned — the pie colours this
  // section by position.
  color: SectionColorKeyT | null
}

export type KosztorysItemT = {
  id: number
  sectionId: number
  displayOrder: number
  description: string | null
  unit: string | null
  plannedQty: number
  // „Pomiar z natury" as the imported sheet typed it — a reconciliation reference, never an input to
  // any figure. null = the sheet made no claim (no column, empty cell, or a formula that only
  // restates Σ etapów). The app never edits it: a re-import overwrites it wholesale.
  sheetMeasuredQty: number | null
  discountType: DiscountTypeT | null
  discountValue: number
  clientPrice: number
  // Per-item subcontractor stawka, one nullable number per plane: a number = a kwota frozen onto
  // the pozycja, null = „auto", derive it from the investment's effective współczynnik. `0` is a
  // kwota like any other — a stawka someone set to zero on purpose — so it is NOT null and no
  // reader may fold the two together (EX-766).
  wToolsOverrideValue: number | null
  ownToolsOverrideValue: number | null
  note: string | null
}

// Single source of truth for the autosave patch: imported by the pure core (v2-rows diffRow) and by
// updateItemFieldAction, whose zod validation is derived from this shape.
export type ItemPatchT = Partial<
  Pick<
    KosztorysItemT,
    | 'description'
    | 'unit'
    | 'plannedQty'
    | 'discountType'
    | 'discountValue'
    | 'clientPrice'
    | 'wToolsOverrideValue'
    | 'ownToolsOverrideValue'
    | 'note'
  >
>

// Subcontractor markup coefficients, one pair per investment.
export type KosztorysGlobalCoeffsT = { wTools: number; ownTools: number }

// Minimal shape for deriving the view price; KosztorysV2RowT satisfies it.
export type ViewPricingT = KosztorysItemT & {
  // Denormalized: the investment's global discount is set — per-item discounts stop applying
  // (applyDiscount returns gross), the global discount is subtracted once at the total level.
  globalDiscountActive: boolean
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
}

// PriceViewT without 'client', so a plane IS a valid price view and flows straight into viewPrice().
// The grain is the etap, not the pozycja (EX-565, owner-confirmed). null = undecided, which is NOT a
// plane: such an etap belongs to no subcontractor bill and counts toward neither settlement figure.
export type ToolPlaneT = 'w_tools' | 'own_tools'

export type KosztorysStageT = {
  id: number
  ordinal: number
  label: string | null
  plane: ToolPlaneT | null
  workerId: number | null
}

// Mirrors ItemPatchT; the action's zod validation is derived from this shape. plane is never patched
// to null — an explicit pick only ever confirms a concrete plane.
export type StagePatchT = Partial<{
  label: string | null
  plane: ToolPlaneT
  // Nullable unlike plane: „Bez przypisania" is a legal edit, so the patch must be able to clear it.
  workerId: number | null
}>

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
  // One rate per investment, denormalized onto each row.
  vatRate: number
  // Rides the tree (not the rows) because it is one value for the whole sheet and nothing per-row
  // branches on it — unlike vatRate above.
  settlementMode: SettlementModeT
  // Fraction (0.23 = 23%) at which materiały are billed netto instead of at the brutto receipt.
  // `null` = the concession is off, which is a different state from 0%.
  materialsNetRate: number | null
  // The `active` flag is denormalized onto each row; the amount is subtracted once at the total level.
  globalDiscount: GlobalDiscountT
  // Change token = investment.updatedAt (ISO), which a restore always bumps. The editor shell keys
  // its restore remount on it rather than on the `tree` prop's identity, which router.refresh
  // reshapes every time.
  revision: string
}

// The tree plus the investment-level figures the footer reconciles against. Assembled identically by
// the admin page, the owner preview and the public share read, so the three can't drift. Every figure
// is a row set or a server aggregate — a derived twin is how two hosts start disagreeing (EX-680).
export type KosztorysEditorDataT = {
  investmentId: number
  tree: KosztorysTreeT
  investmentName: string
  // Kept apart all the way down: only `materialsGrossBase` may be repriced by the „wszystko netto"
  // toggle. Their sum is the billed materiały total.
  materialsGrossBase: number
  materialsNetBilled: number
  materialsBreakdown: MaterialsBreakdownRowT[]
  // Company-plane material folded into robocizna, split per category.
  settledBreakdown: MaterialsBreakdownRowT[]
  // Transaction-sourced robocizna/rabat (Σ LABOR_COST / Σ RABAT) — the reconciliation "actual" side.
  laborCostsNetFromTransactions: number
  discountNetFromTransactions: number
  // Σ LOSS — the cost the company absorbed, which the settlement deducts at face value.
  investmentLoss: number
  // Realized PAYOUT rows: the block's sortable wypłaty list AND its per-worker Σ. Optional (default
  // []) because the two client-view share entry points never render that block.
  payoutTransactions?: PayoutTransactionRowT[]
  // Required: the wpłaty TOTAL is summed from these rows, so a host that omits them isn't showing an
  // empty list — it is showing zero wpłaty against a debt that never got them deducted.
  depositTransactions: DepositTransactionRowT[]
  // Both settled states. Required: every entry point serves this list, the client share included.
  materialTransactions: MaterialTransactionRowT[]
  // Optional only for the ROLE gate the investment page applies (a MANAGER gets no marża), never as
  // client-share stripping: both preview entrances pass it, so they compute from identical inputs.
  financials?: InvestmentFinancialsT
  // Gates the toolbar's „Arkusz Google" entries, which would otherwise offer an import that can only
  // answer „Inwestycja nie ma kosztorysu.". Optional: the client share renders no toolbar.
  hasSheet?: boolean
  // „Zakończona": every money-moving write is refused server-side. The editor still renders in FULL
  // — this is about interaction, not disclosure, which is what `preview` is about.
  locked?: boolean
  // Set ONLY by the szablon workbench; its presence is what tells the toolbar „Zapisz" overwrites a
  // szablon rather than asking for a name. The id and not the name, because the name can be taken by
  // another szablon between opening and saving. Never derived from the pathname.
  templatePresetId?: number
  // Optional on cost, not on visibility: the client share renders no stage menu (EX-613).
  workers?: WorkerRefT[]
}

// --- v2 variant (react-datasheet-grid): a flat row with stages flattened
// into stage_<stageId> keys so that keyColumn maps 1:1. ---
export type KosztorysV2RowBaseT = KosztorysItemT & {
  sectionName: string
  // Denormalized like sectionName: `rows` is the only carrier that reaches the summary subtotals,
  // and the grid marker reads it per row.
  sectionColor: SectionColorKeyT | null
  // Denormalized investment VAT rate (one for the whole kosztorys) — gross = net × (1 + vatRate).
  vatRate: number
  globalDiscountActive: boolean
  // Denormalized global coefficients for deriving the subcontractor price on the row (ViewPricingT).
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
}

// Keyed off the constant so the type and diffRow's runtime `startsWith` can't drift. `import type`
// keeps it erased — no runtime cycle with constants.ts, which imports types from here.
export type StageKeyT = `${typeof STAGE_QTY_PREFIX}${number}`

export type KosztorysV2RowT = KosztorysV2RowBaseT & {
  [stageKey: StageKeyT]: number
}

export type SectionSubtotalT = {
  sectionId: number
  sectionName: string
  // Carried through so the Podsumowanie pie can honour the section's pinned colour.
  sectionColor: SectionColorKeyT | null
  net: number // executed (the sheet's T), at the active price view — a MONEY figure
  // Offered (the sheet's S), at the active price view — a MONEY figure. `null` outside the client
  // view: the przedmiar is typed once for the WHOLE offered scope, so beside a plane-filtered `net`
  // it would put one crew's numerator over everyone's denominator. There is no correct subcontractor
  // reading to substitute — 0 would claim nothing was offered — so it is withheld, not guessed.
  plannedNet: number | null

  // Σ per-item rabat taken on the executed qty, at the active price view — a MONEY figure. 0 when
  // the global discount is active. Lets the totals show „Rabat" without re-deriving it.
  discount: number
  // 0..1, the section's share of all sections' executed value — weighted at the CLIENT price only, so
  // like completionRatio it is a STRUCTURE figure that must not move with the price view.
  share: number
  // Completion (executed ÷ offered) weighted at the CLIENT price only — a PROGRESS figure, so it
  // must not move with the price view. `null` when there is no offer to divide by.
  completionRatio: number | null
  itemCount: number
}

// Built at the client view, where the przedmiar figure is always present, so consumers pinned to it
// (progress counter, section pie) never handle a `null` their call site already ruled out.
export type SectionSubtotalClientT = SectionSubtotalT & { plannedNet: number }
