import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import type { CashRegisterTypeT } from '@/types/reference-data'
import type { SheetStatusT } from '@/lib/constants/sheets'
import type { RoleT } from '@/lib/auth/roles'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { StrandedDepositsT } from '@/lib/kosztorys/off-plane-deposits'
import type { WorkerColumnFiguresT } from '@/lib/kosztorys/worker-payout-pairs'

/** The shapes a listing query hands to the table that renders it — a contract between the two
 *  layers, not a property of either. They live here rather than in the table component because the
 *  producers sit BELOW the components: `lib/queries/**` and the plain-node parity audit both build
 *  these rows, and importing a `.tsx` module to learn the shape is what forced that audit to
 *  re-derive formulas instead of calling the real builder. */
export type InvestmentRowT = {
  id: number
  name: string
  status: InvestmentStatusT
  totalMaterialCosts: number
  totalIncome: number
  /** Kosztorys plane, pre-rabat. Its twin below is pre-rabat too, so the two subtract cleanly.
   *  `totalLaborCosts` keeps the bare name because the parity fixture is keyed by it; the suffix on
   *  the twin is what warns that a second plane exists. */
  totalLaborCosts: number
  totalLaborCostsFromTransactions: number
  totalPayouts: number
  totalInvestmentExpense: number
  totalSettled: number
  balance: number
  balanceGross: number
  /** The wpłaty `balanceGross` silently drops — a gotówka has no brutto kwota, so in tryb brutto it
   *  deducts nothing and the client reads as owing more than he does. Absent means nothing is wrong:
   *  only tryb brutto strands anything, and the cell renders the marker exactly when this is here. */
  strandedDeposits?: StrandedDepositsT
  /** The same bilans on the transactions plane. Both are shown while investments are still being
   *  moved off the sheets: for one that has no kosztorys in the app yet, this is the only reading
   *  that carries its robocizna at all. */
  balanceFromTransactions: number
  /** The v1 formula on the transactions plane — the figure the investment page's v1 shows. It reads
   *  the raw transfers on purpose: fed the kosztorys robocizna it was neither reading, and matched
   *  no other surface in the app. */
  margin: number
  /** The EX-649 reading, beside `margin` rather than instead of it. Absent where an etap holds
   *  executed work with no rozliczenie — the figure is unknowable, not zero. `undefined` and not
   *  `null` because TanStack's `sortUndefined` is the only thing that keeps those rows out of the
   *  numeric comparator, which would read them as 0. */
  marginV2?: number
  /** The kosztorys Podwykonawcy headline „Pozostało do wypłaty": należne for executed work plus
   *  the premie, minus the wypłaty booked. Negative when the crews were paid ahead of the work. Absent both without a
   *  kosztorys (it would read −wypłaty and sort among real overpayments) and where an etap holds
   *  work with no rozliczenie (the należne is short) — `undefined` for the same `sortUndefined`
   *  reason as `marginV2`; the cell tells the two apart by `hasKosztorys`. */
  subcontractorRemaining?: number
  /** Workers still owed on this investment — how many rows the „Rozlicz wypłaty" dialog will prefill. */
  subcontractorsOwed?: number
  address: string
  phone: string
  email: string
  contactPerson: string
  reviewRequested: boolean
  notes: string
  hasSheet: boolean
  createdAt: string
  /** Whether the investment HAS a kosztorys, which none of the figures above can answer: „pomiar z
   *  natury" is the etap sum (EX-494), so a fully entered rozpiska with no etap progress reads zero
   *  robocizny — identical to no kosztorys at all. „Pozostało do wypłaty" withholds on this, not on
   *  the figure, or a zero-progress kosztorys would hide its real −wypłaty; the trash button reads
   *  it too. */
  hasKosztorys: boolean
  // No column renders these — the whole row is handed to EditInvestmentDialog, whose form needs
  // them. `vatRate` is the exception that also prices `balanceGross`.
  materialsNetRate: number | null
  settlementMode: SettlementModeT
  vatRate: number
}

export type CashRegisterRowT = {
  id: number
  name: string
  ownerName: string
  balance: number
  type: CashRegisterTypeT
  active: boolean
}

// A kosztorys is a real Google Sheet registered in the app — either linked to an
// investment or standing alone. This is a distinct entity from an investment
// that simply has no kosztorys yet (see InvestmentWithoutSheetRowT), which is why
// the two now render as separate tables instead of one status-discriminated list.
export type KosztorysRowT = {
  id: string
  status: SheetStatusT
  name: string
  sheetId: number
  sheetName: string
  googleSheetId: string
  investmentId?: number
  investmentName?: string
}

// An investment with no kosztorys yet — the target for "Dodaj kosztorys".
export type InvestmentWithoutSheetRowT = {
  id: string
  investmentId: number
  name: string
}

export type UserRowT = {
  id: number
  name: string
  role: RoleT
  email: string
  active: boolean
  defaultCashRegisterName?: string
  /** Absent when the worker holds no pair on any investment with a kosztorys. */
  payoutRemaining?: WorkerColumnFiguresT
  /** Names of the kasy he owns — they go to the trash with him. */
  registerNames: string[]
  canTrash: boolean
}
