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
// Per-investment global discount over the whole kosztorys. type null = none (per-item discounts
// apply). When set, per-item discounts are overridden and this is subtracted once from the executed
// total (PLN netto). Amount-only: a percent rabat isn't stored here — it's a one-shot tool that
// stamps a percent into every per-item rabat (see applyPercentDiscountToAllItemsAction).
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
  // „Pomiar z natury" exactly as the imported sheet typed it — a reconciliation reference, never an
  // input to any figure. null = the sheet made no claim (no such column, empty cell, or a formula
  // that only restates Σ etapów). Overwritten wholesale by a re-import or by „Zaciągnij pomiary
  // z arkusza" — the app never edits it, so whatever the sheet says today is the answer.
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
    | 'wToolsOverrideValue'
    | 'ownToolsOverrideValue'
    | 'note'
  >
>

// Global (per-investment) subcontractor markup coefficients; carried through the tree.
export type KosztorysGlobalCoeffsT = { wTools: number; ownTools: number }

// Minimal shape for deriving the view price — KosztorysV2RowT satisfies it
// (KosztorysItemT + denormalized global coefficients).
export type ViewPricingT = KosztorysItemT & {
  // Denormalized: the investment's global discount is set — per-item discounts stop applying
  // (applyDiscount returns gross), the global discount is subtracted once at the total level.
  globalDiscountActive: boolean
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
}

// The subcontractor tool-plane — the subset of PriceViewT without 'client', so a plane IS a valid
// price view and flows straight into viewPrice(). The grain is the etap, not the pozycja
// (EX-565, owner-confirmed).
// null = undecided, which is NOT a plane: such an etap belongs to no subcontractor bill and counts
// toward neither settlement figure.
export type ToolPlaneT = 'w_tools' | 'own_tools'

export type KosztorysStageT = {
  id: number
  ordinal: number
  label: string | null
  plane: ToolPlaneT | null
  workerId: number | null
}

// Stage autosave patch = the fields the header edits one at a time (rename → label, plane picker →
// plane, worker picker → workerId). Mirrors ItemPatchT; the action's zod validation is derived from
// this shape. plane is never patched to null — an explicit pick only ever confirms a concrete plane.
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
  // A single VAT rate per investment — carried through the tree (like globalCoeffs), denormalized onto each row.
  vatRate: number
  // Rides the tree (not the rows) because it is one value for the whole sheet and nothing per-row
  // branches on it — unlike vatRate above.
  settlementMode: SettlementModeT
  // Fraction (0.23 = 23%) at which materiały are billed netto instead of at the brutto receipt.
  // `null` = the concession is off, which is a different state from 0%.
  materialsNetRate: number | null
  // A single global discount per investment — its `active` flag is denormalized onto each row (see
  // KosztorysV2RowBaseT.globalDiscountActive), the amount is subtracted once at the total level.
  globalDiscount: GlobalDiscountT
  // Server-supplied change token = investment.updatedAt (ISO). A restore always bumps it (its final
  // payload.update stamps updatedAt), so the editor shell can key its restore remount on this token
  // changing rather than on the `tree` prop's object identity, which router.refresh reshapes every time.
  revision: string
}

// The full data set the editor body/shell needs to render: the tree plus the investment-level figures
// (materials, wpłaty, robocizna/rabat) the footer reconciles against. Assembled identically by the
// admin page, the owner preview and the public share read — one shape so those three can't drift on
// which figures the editor receives. Every figure here is a row set or a server aggregate, and nothing
// derivable from one of them sits beside it: a derived twin is how two hosts start disagreeing (EX-680).
export type KosztorysEditorDataT = {
  investmentId: number
  tree: KosztorysTreeT
  investmentName: string
  // The two materiały buckets, kept apart all the way down: only `materialsGrossBase` may be
  // repriced by the global „wszystko netto" toggle. Their sum is the billed materiały total.
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
  // Individual realized PAYOUT rows for the subcontractor summary block — its sortable wypłaty list
  // AND its per-worker Σ, derived in the block. Optional (default []) because the two client-view
  // share entry points never render that block and don't supply them.
  payoutTransactions?: PayoutTransactionRowT[]
  // Individual deposit rows for the client Podsumowanie's sortable wpłaty list. Required: the wpłaty
  // TOTAL is summed from these rows, so a host that omits them isn't showing an empty list — it is
  // showing zero wpłaty against a debt that never got them deducted.
  depositTransactions: DepositTransactionRowT[]
  // Individual materiały rows for the Podsumowanie's wydatki list (data · typ · kwota), both settled
  // states. Required: every entry point serves this list, the client share path included.
  materialTransactions: MaterialTransactionRowT[]
  // Company-plane transfer aggregates behind the „Marża" tab. Optional only for the ROLE gate the
  // investment page applies (a MANAGER gets no marża) — never as client-share stripping: both preview
  // entrances pass it, so the preview and the owner's own panel compute from identical inputs.
  financials?: InvestmentFinancialsT
  // Whether the investment has a Google sheet linked. Gates the toolbar's „Arkusz Google" entries,
  // which would otherwise offer an import/compare that can only answer „Inwestycja nie ma kosztorysu.".
  // Optional: the client-share entry points render no toolbar, so they have nothing to gate.
  hasSheet?: boolean
  // The investment is „Zakończona", so every money-moving write is refused server-side. The editor
  // renders in FULL — this is about interaction, not disclosure, which is what `preview` is about.
  // Optional: the client-share entry points render the preview and never ask.
  locked?: boolean
  // Roster for the etap header's worker picker (EX-613). Optional on cost, not on visibility: the
  // client-share entry points render no stage menu, so fetching the roster there buys nothing.
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
  // Carried through so the Podsumowanie pie can honour the section's pinned colour.
  sectionColor: SectionColorKeyT | null
  net: number // executed (the sheet's T), at the active price view — a MONEY figure
  // Offered (the sheet's S), at the active price view — a MONEY figure. `null` outside the client
  // view, and that is the whole point: the przedmiar is typed once per row for the WHOLE offered
  // scope and carries no rozliczenie, so beside a plane-filtered `net` it would put one crew's
  // numerator over everyone's denominator. There is no correct subcontractor reading to substitute —
  // 0 would claim nothing was offered — so the figure is withheld rather than guessed.
  plannedNet: number | null

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

// A subtotal built at the client view, where the przedmiar figure is always present. Consumers pinned
// to that view (the progress counter, the section pie) take this and never handle a `null` that their
// call site has already ruled out — sectionSubtotalsForView's overload hands it to them.
export type SectionSubtotalClientT = SectionSubtotalT & { plannedNet: number }
