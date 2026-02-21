export const TRANSFER_TYPES = [
  'INVESTOR_DEPOSIT',
  'STAGE_SETTLEMENT',
  'COMPANY_FUNDING',
  'OTHER_DEPOSIT',
  'INVESTMENT_EXPENSE',
  'ACCOUNT_FUNDING',
  'EMPLOYEE_EXPENSE',
  'REGISTER_TRANSFER',
  'OTHER',
] as const
export type TransferTypeT = (typeof TRANSFER_TYPES)[number]

export const TRANSFER_TYPE_LABELS: Record<TransferTypeT, string> = {
  INVESTOR_DEPOSIT: 'Wpłata od inwestora',
  STAGE_SETTLEMENT: 'Rozliczenie etapu',
  COMPANY_FUNDING: 'Zasilenie z konta firmowego',
  OTHER_DEPOSIT: 'Inna wpłata',
  INVESTMENT_EXPENSE: 'Wydatek inwestycyjny',
  ACCOUNT_FUNDING: 'Zasilenie konta współpracownika',
  EMPLOYEE_EXPENSE: 'Wydatek pracowniczy',
  REGISTER_TRANSFER: 'Transfer między kasami',
  OTHER: 'Inne',
}

export const DEPOSIT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'STAGE_SETTLEMENT',
  'COMPANY_FUNDING',
  'OTHER_DEPOSIT',
]

// Deposit types visible in the deposit dialog (OTHER_DEPOSIT is internal-only)
export const DEPOSIT_UI_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'STAGE_SETTLEMENT',
  'COMPANY_FUNDING',
]

export const PAYMENT_METHODS = ['CASH', 'BLIK', 'TRANSFER', 'CARD'] as const
export type PaymentMethodT = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodT, string> = {
  CASH: 'Gotówka',
  BLIK: 'BLIK',
  TRANSFER: 'Przelew',
  CARD: 'Karta',
}

export const COST_TYPES: TransferTypeT[] = ['INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE']
export const INCOME_TYPES: TransferTypeT[] = ['INVESTOR_DEPOSIT', 'STAGE_SETTLEMENT']
export const INVESTMENT_TYPES: TransferTypeT[] = [...COST_TYPES, ...INCOME_TYPES]

export const isDepositType = (type: string) => (DEPOSIT_TYPES as readonly string[]).includes(type)

export const needsCashRegister = (type: string) => type !== 'EMPLOYEE_EXPENSE'

export const showsInvestment = (type: string) =>
  type === 'INVESTOR_DEPOSIT' ||
  type === 'STAGE_SETTLEMENT' ||
  type === 'INVESTMENT_EXPENSE' ||
  type === 'EMPLOYEE_EXPENSE'

export const requiresInvestment = (type: string) =>
  type === 'INVESTOR_DEPOSIT' || type === 'STAGE_SETTLEMENT' || type === 'INVESTMENT_EXPENSE'

export const needsWorker = (type: string) =>
  type === 'ACCOUNT_FUNDING' || type === 'EMPLOYEE_EXPENSE'

export const needsTargetRegister = (type: string) => type === 'REGISTER_TRANSFER'

export const needsOtherCategory = (type: string) => type === 'OTHER' || type === 'EMPLOYEE_EXPENSE'
