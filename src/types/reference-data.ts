import type { RoleT } from '@/lib/auth/roles'
import type { VatPlaneT } from '@/lib/constants/transfers'

export type ReferenceItemT = {
  id: number
  name: string
  type?: string
  active?: boolean
  ownerId?: number
  defaultCashRegisterId?: number
}

export type CashRegisterTypeT = 'MAIN' | 'AUXILIARY' | 'VIRTUAL' | 'WORKER'

export type InvestmentStatusT = 'active' | 'completed' | 'planowana'

export type CashRegisterRefT = Omit<ReferenceItemT, 'type'> & {
  type: CashRegisterTypeT
}

export type InvestmentRefT = ReferenceItemT & {
  status: InvestmentStatusT
  address: string
  phone: string
  email: string
  contactPerson: string
  notes: string
  review: string
  hasSheet: boolean
}

export type WorkerRefT = Omit<ReferenceItemT, 'type'> & {
  role: RoleT
  email: string
}

// Raw PAYOUT-per-worker aggregate for one investment. `workerId` is null for the „Bez przypisanego
// pracownika" bucket — a real cash payout with no worker attached, which must still count toward Σ
// zaliczek. Names are NOT joined here (query stays tagged on transfers alone); the page enriches.
export type PayoutByWorkerT = {
  workerId: number | null
  total: number
}

// The page-enriched PAYOUT-per-worker row: `PayoutByWorkerT` plus the worker's name resolved from
// reference data (null worker → „Bez przypisanego pracownika"). This is what the editor prop chain
// carries down to the subcontractor summary block.
export type SubcontractorPayoutRowT = PayoutByWorkerT & {
  name: string
}

// One realized PAYOUT transaction, for the subcontractor block's sortable wypłaty list. Worker name
// resolves at render from the SubcontractorPayoutRowT set.
export type PayoutTransactionRowT = {
  workerId: number | null
  date: string
  amount: number
  description: string | null
}

// One deposit transaction (INVESTOR_DEPOSIT / COMPANY_FUNDING) for the client Podsumowanie's wpłaty
// list — mirrors PayoutTransactionRowT. `vatPlane` is null for the „nie określono" default state.
export type DepositTransactionRowT = {
  id: number
  date: string
  amount: number
  vatPlane: VatPlaneT | null
}

export type OtherCategoryRefT = {
  id: number
  name: string
}

export type ExpenseCategoryRefT = {
  id: number
  name: string
}

export type ReferenceDataBaseT = {
  cashRegisters: CashRegisterRefT[]
  investments: InvestmentRefT[]
  workers: WorkerRefT[]
  otherCategories: OtherCategoryRefT[]
  expenseCategories: ExpenseCategoryRefT[]
}

export type ReferenceDataT = ReferenceDataBaseT & {
  currentUserId: number
  currentUserRole: RoleT
}
