import type { RoleT } from '@/lib/auth/roles'
import type { LanguageT } from '@/lib/i18n/languages'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import type { InvestmentAiStageT } from '@/lib/constants/investment-ai-stage'

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
  reviewRequested: boolean
  hasSheet: boolean
  aiStage: InvestmentAiStageT | null
  createdAt: string
  // `vatRate` is non-null because the read applies DEFAULT_VAT — a null here would make the brutto
  // column NaN.
  materialsNetRate: number | null
  settlementMode: SettlementModeT
  vatRate: number
}

export type InvestmentNotesT = {
  notes: string
  aiNotes: string
}

// The edit dialog takes this type, not the slim one: it sends every field back, so a ref with blank
// notes would overwrite the real ones.
export type InvestmentWithNotesT = InvestmentRefT & InvestmentNotesT

export type WorkerRefT = Omit<ReferenceItemT, 'type'> & {
  role: RoleT
  email: string
  language: LanguageT | null
  canAddExpensesWithoutInvestment: boolean
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
  trashedCashRegisters: CashRegisterRefT[]
  investments: InvestmentRefT[]
  trashedInvestments: InvestmentRefT[]
  workers: WorkerRefT[]
  trashedWorkers: WorkerRefT[]
  otherCategories: OtherCategoryRefT[]
  expenseCategories: ExpenseCategoryRefT[]
}

export type ReferenceDataT = ReferenceDataBaseT & {
  currentUserId: number
  currentUserRole: RoleT
}

export type ReviewRequestInvestmentT = Pick<
  InvestmentRefT,
  'id' | 'name' | 'email' | 'reviewRequested'
>
