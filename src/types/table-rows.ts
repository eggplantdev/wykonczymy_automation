import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import type { CashRegisterTypeT, InvestmentBillingT } from '@/types/reference-data'
import type { SheetStatusT } from '@/lib/constants/sheets'
import type { RoleT } from '@/lib/auth/roles'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { AiProgressStepT } from '@/lib/constants/investment-ai-stage'
import type { StrandedDepositsT } from '@/lib/kosztorys/off-plane-deposits'
import type { WorkerColumnFiguresT } from '@/lib/kosztorys/worker-payout-pairs'

export type InvestmentRowT = {
  id: number
  name: string
  status: InvestmentStatusT
  totalMaterialCosts: number
  totalIncome: number
  /** `totalLaborCosts` keeps the bare name because the parity fixture is keyed by it */
  totalLaborCosts: number
  totalLaborCostsFromTransactions: number
  totalPayouts: number
  totalInvestmentExpense: number
  totalSettled: number
  balance: number
  balanceGross: number
  /** The wpłaty `balanceGross` silently drops — a gotówka has no brutto kwota, so in tryb brutto it
   *  deducts nothing and the client reads as owing more than he does. */
  strandedDeposits?: StrandedDepositsT
  balanceFromTransactions: number
  margin: number
  /** `undefined` and not `null` because TanStack's `sortUndefined` is the only thing that keeps
   *  those rows out of the numeric comparator, which would read them as 0. */
  marginV2?: number
  subcontractorRemaining?: number
  subcontractorsOwed?: number
  address: string
  postalCode: string
  city: string
  country: string
  phone: string
  email: string
  contactPerson: string
  billing: InvestmentBillingT
  reviewRequested: boolean
  notes: string
  hasSheet: boolean
  createdAt: string
  /** Whether the investment HAS a kosztorys, which none of the figures above can answer: a fully
   *  entered rozpiska with no etap progress reads zero robocizny — identical to no kosztorys at all. */
  hasKosztorys: boolean
  aiProgress: AiProgressStepT
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
  registerNames: string[]
  canTrash: boolean
}
