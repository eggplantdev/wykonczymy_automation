import type { InvestmentLockT } from '@/lib/constants/investment-lock'
import type { InsertDirectionT } from '@/lib/kosztorys/display-order'
import type { STAGE_QTY_PREFIX } from '@/lib/kosztorys/stage-keys'
import type { REVIEW_STATUSES } from '@/lib/kosztorys/review-status'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { InvestmentFinancialsT, MaterialsBreakdownRowT } from '@/types/investment-financials'
import type { MediaFileT } from '@/types/media'
import type { DescriptionTranslationsT } from '@/lib/i18n/description-translations'
import type { InvestmentWithNotesT, WorkerRefT } from '@/types/reference-data'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import type {
  PayoutTransactionRowT,
  DepositTransactionRowT,
  MaterialTransactionRowT,
} from '@/types/transfers'

export type DiscountTypeT = 'percent' | 'amount'
export type GlobalDiscountT = { type: 'amount' | null; value: number }
export type KosztorysSectionT = {
  id: number
  name: string
  displayOrder: number
  color: SectionColorKeyT | null
}

export type ReviewStatusT = (typeof REVIEW_STATUSES)[number]

export type KosztorysItemT = {
  id: number
  ref?: number
  sectionId: number
  displayOrder: number
  description: string | null
  // Copied with the opis wherever the opis is copied; never re-read from the katalog afterwards.
  descriptionTranslations: DescriptionTranslationsT
  unit: string | null
  plannedQty: number
  // null = never edited by hand, so it follows `plannedQty`; 0 = the pozycja dropped out of
  // scope. Read it through `resolvedCurrentPlannedQty`, never directly.
  currentPlannedQty: number | null
  // „Pomiar z natury" as the imported sheet typed it — a reconciliation reference, never an input to
  // any figure.
  sheetMeasuredQty: number | null
  discountType: DiscountTypeT | null
  discountValue: number
  clientPrice: number
  // null = „auto", derive it from the investment's effective współczynnik. `0` is a kwota like any
  // other — a stawka someone set to zero on purpose — so it is NOT null and no reader may fold the
  // two together.
  wToolsOverrideValue: number | null
  ownToolsOverrideValue: number | null
  wToolsOverrideCoeff: number | null
  ownToolsOverrideCoeff: number | null
  note: string | null
  // A soft reference: it may name an entry deleted since, so a reader resolves it, never trusts it.
  catalogueItemId: number | null
  // null = the agent never saw this row, 0 = it saw the row and left it out — the two read
  // differently in review, so neither may stand in for the other.
  aiPlannedQty: number | null
  aiMissingData?: string | null
  aiAssumptions?: string | null
  aiNewInformation?: string | null
  aiRecheck?: boolean
  changeReason: string | null
  reviewStatus: ReviewStatusT | null
}

export type PriceSourceT = 'auto' | 'coeff' | 'amount'

export type NewItemPlacementT =
  | { kind: 'end'; sectionId: number }
  | { kind: 'next-to'; anchorItemId: number; dir: InsertDirectionT }

export type ItemPatchT = Partial<
  Pick<
    KosztorysItemT,
    | 'description'
    | 'descriptionTranslations'
    | 'unit'
    | 'plannedQty'
    | 'currentPlannedQty'
    | 'discountType'
    | 'discountValue'
    | 'clientPrice'
    | 'wToolsOverrideValue'
    | 'ownToolsOverrideValue'
    | 'wToolsOverrideCoeff'
    | 'ownToolsOverrideCoeff'
    | 'note'
    | 'changeReason'
    | 'reviewStatus'
    | 'aiRecheck'
  >
>

export type KosztorysGlobalCoeffsT = { wTools: number; ownTools: number }

export type ViewPricingT = KosztorysItemT & {
  globalDiscountActive: boolean
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
}

// null = undecided, which is NOT a plane: such an etap belongs to no subcontractor bill and counts
// toward neither settlement figure.
export type ToolPlaneT = 'w_tools' | 'own_tools'

// `value` is percent points (25 = 25%) in 'percent' mode and zł in 'amount' mode, and is meaningless
// on the rest holder.
export type StageSplitModeT = 'percent' | 'amount'

export type StageMemberT = {
  workerId: number
  value: number
  takesRest: boolean
}

export type StageSplitT = {
  mode: StageSplitModeT
  members: StageMemberT[]
}

export type KosztorysStageT = {
  id: number
  ordinal: number
  label: string | null
  plane: ToolPlaneT | null
  // null = nobody assigned. Never a split without members — the reader normalises that to null.
  split: StageSplitT | null
  completed: boolean
}

export type StagePatchT = Partial<{
  label: string | null
  plane: ToolPlaneT
  completed: boolean
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
  vatRate: number
  settlementMode: SettlementModeT
  // Fraction (0.23 = 23%) at which materiały are billed netto instead of at the brutto receipt.
  // `null` = the concession is off, which is a different state from 0%.
  materialsNetRate: number | null
  globalDiscount: GlobalDiscountT
  revision: string
}

export type KosztorysEditorDataT = {
  investmentId: number
  tree: KosztorysTreeT
  investmentName: string
  // Kept apart all the way down: only `materialsGrossBase` may be repriced by the „wszystko netto"
  // toggle.
  materialsGrossBase: number
  materialsNetBilled: number
  materialsBreakdown: MaterialsBreakdownRowT[]
  // Company-plane material folded into robocizna, split per category.
  settledBreakdown: MaterialsBreakdownRowT[]
  laborCostsNetFromTransactions: number
  discountNetFromTransactions: number
  investmentLoss: number
  payoutTransactions?: PayoutTransactionRowT[]
  // Required: the wpłaty TOTAL is summed from these rows, so a host that omits them isn't showing an
  // empty list — it is showing zero wpłaty against a debt that never got them deducted.
  depositTransactions: DepositTransactionRowT[]
  materialTransactions: MaterialTransactionRowT[]
  financials?: InvestmentFinancialsT
  hasSheet?: boolean
  lock?: InvestmentLockT
  // Set ONLY by the szablon page. Never derived from the pathname.
  isTemplate?: boolean
  workers?: WorkerRefT[]
  workCatalogue?: WorkCatalogueItemT[]
  // The investment's „Zdjęcia i pliki". `undefined` means „this surface has no gallery" (the szablon
  // workbench, both shares); `[]` means the investment simply has no files yet.
  assets?: MediaFileT[]
  investment?: InvestmentWithNotesT
  workerReports?: WorkerReportsSeedT
}

export type WorkerReportsSeedT = {
  pendingCount: number
  openReportId: number | undefined
}

export type KosztorysV2RowBaseT = KosztorysItemT & {
  sectionName: string
  sectionColor: SectionColorKeyT | null
  vatRate: number
  globalDiscountActive: boolean
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
}

export type StageKeyT = `${typeof STAGE_QTY_PREFIX}${number}`

export type KosztorysV2RowT = KosztorysV2RowBaseT & {
  [stageKey: StageKeyT]: number
}

export type SectionMetaT = Pick<KosztorysV2RowT, 'sectionId' | 'sectionName' | 'sectionColor'>

export type SectionSubtotalT = {
  sectionId: number
  sectionName: string
  sectionColor: SectionColorKeyT | null
  net: number // executed (the sheet's T), at the active price view — a MONEY figure
  // Offered (the sheet's S). `null` outside the client view: the przedmiar is typed once for the
  // WHOLE offered scope, so beside a plane-filtered `net` it would put one crew's numerator over
  // everyone's denominator.
  plannedNet: number | null
  currentPlannedNet: number | null

  discount: number
  share: number
  // Weighted at the CLIENT price only — so it must not move with the price view.
  completionRatio: number | null
  itemCount: number
}

export type SectionSubtotalClientT = SectionSubtotalT & {
  plannedNet: number
  currentPlannedNet: number
}
