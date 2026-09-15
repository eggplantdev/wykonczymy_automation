import type { RoleT } from '@/lib/auth/roles'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'

export type ReferenceItemT = {
  id: number
  name: string
  type?: string
  active?: boolean
  ownerId?: number
  defaultCashRegisterId?: number
}

export type CashRegisterTypeT = 'MAIN' | 'AUXILIARY' | 'VIRTUAL' | 'WORKER'

export type InvestmentStatusT = 'active' | 'completed' | 'planowana' | 'szablon'

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
  // The materiały concession is gated on the settlement mode, so a reader that has one without the
  // other cannot compute it (null rate = no concession); VAT rides the prace alone and turns
  // „Bilans netto" into „Bilans brutto". `vatRate` is non-null because the read applies DEFAULT_VAT —
  // a null here would make the brutto column NaN.
  materialsNetRate: number | null
  settlementMode: SettlementModeT
  vatRate: number
}

export type WorkerRefT = Omit<ReferenceItemT, 'type'> & {
  role: RoleT
  email: string
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
