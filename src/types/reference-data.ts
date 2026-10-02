import type { RoleT } from '@/lib/auth/roles'
import type { LanguageT } from '@/lib/i18n/languages'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'

export type ReferenceItemT = {
  id: number
  name: string
  type?: string
  active?: boolean
  ownerId?: number
  defaultCashRegisterId?: number
}

export type CashRegisterTypeT = 'MAIN' | 'AUXILIARY' | 'VIRTUAL' | 'WORKER'

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
  reviewRequested: boolean
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
  language: LanguageT | null
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
  /** For naming a trashed kasa on its old transaction rows only — never a picker or listing. */
  trashedCashRegisters: CashRegisterRefT[]
  investments: InvestmentRefT[]
  /** Only for opening a trashed investment read-only from /kosz — never a picker or listing. */
  trashedInvestments: InvestmentRefT[]
  workers: WorkerRefT[]
  /** For naming a trashed worker on old rows only — never a picker or listing. */
  trashedWorkers: WorkerRefT[]
  otherCategories: OtherCategoryRefT[]
  expenseCategories: ExpenseCategoryRefT[]
}

export type ReferenceDataT = ReferenceDataBaseT & {
  currentUserId: number
  currentUserRole: RoleT
}
