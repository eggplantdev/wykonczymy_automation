import { createFormStore } from '@/stores/create-form-store'
import type { InvestmentFormValuesT } from '@/components/forms/investment-form/investment-schema'

type DepositFormValuesT = {
  description: string
  amount: string
  date: string
  type: string
  paymentMethod: string
  sourceRegister: string
  investment?: string
}

type LineItemT = {
  description: string
  amount: string
  invoiceNote: string
  category: string
  expenseCategory: string
}

type ExpenseFormValuesT = {
  date: string
  type: string
  paymentMethod: string
  sourceRegister: string
  targetRegister: string
  investment: string
  lineItems: LineItemT[]
}

type InternalTransferFormValuesT = {
  description: string
  amount: string
  date: string
  paymentMethod: string
  sourceRegister: string
  targetRegister: string
}

export const useDepositFormStore = createFormStore<DepositFormValuesT>('deposit-form')
export const useExpenseFormStore = createFormStore<ExpenseFormValuesT>('expense-form')
export const useInternalTransferFormStore =
  createFormStore<InternalTransferFormValuesT>('internal-transfer-form')
export const useInvestmentFormStore = createFormStore<InvestmentFormValuesT>('investment-form')
