// Sorted alphabetically by Polish label
export const TRANSFER_TYPES = [
  'CANCELLATION', // Anulowanie
  'OTHER_DEPOSIT', // Inna wpłata
  'OTHER', // Inne
  'LABOR_COST', // Koszty robocizny
  'REGISTER_TRANSFER', // Transfer między kasami
  'INVESTOR_DEPOSIT', // Wpłata od inwestora
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'EMPLOYEE_EXPENSE', // Wydatek pracowniczy
  'PAYOUT', // Wypłata
  'ACCOUNT_FUNDING', // Zasilenie konta współpracownika
  'COMPANY_FUNDING', // Zasilenie z konta firmowego
] as const
export type TransferTypeT = (typeof TRANSFER_TYPES)[number]

export const TRANSFER_TYPE_LABELS: Record<TransferTypeT, string> = {
  INVESTOR_DEPOSIT: 'Wpłata od inwestora',
  COMPANY_FUNDING: 'Zasilenie z konta firmowego',
  OTHER_DEPOSIT: 'Inna wpłata',
  INVESTMENT_EXPENSE: 'Wydatek inwestycyjny',
  ACCOUNT_FUNDING: 'Zasilenie konta współpracownika',
  EMPLOYEE_EXPENSE: 'Wydatek pracowniczy',
  LABOR_COST: 'Koszty robocizny',
  PAYOUT: 'Wypłata',
  REGISTER_TRANSFER: 'Transfer między kasami',
  OTHER: 'Inne',
  CANCELLATION: 'Anulowanie',
}

export const DEPOSIT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'COMPANY_FUNDING',
  'OTHER_DEPOSIT',
]

// Deposit types visible in the deposit dialog (sorted by Polish label)
export const DEPOSIT_UI_TYPES: TransferTypeT[] = [
  'OTHER_DEPOSIT', // Inna wpłata
  'INVESTOR_DEPOSIT', // Wpłata od inwestora
  'COMPANY_FUNDING', // Zasilenie z konta firmowego
]

// Transfer types visible in the transaction transfer dialog (sorted by Polish label)
export const TRANSACTION_TRANSFER_TYPES: TransferTypeT[] = [
  'OTHER', // Inne
  'LABOR_COST', // Koszty robocizny
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'PAYOUT', // Wypłata
  'ACCOUNT_FUNDING', // Zasilenie konta współpracownika
]

export const PAYMENT_METHODS = [
  'CASH',
  // 'BLIK',
  // 'TRANSFER',
  // 'CARD',
] as const
export type PaymentMethodT = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodT, string> = {
  CASH: 'Gotówka',
  // BLIK: 'BLIK',
  // TRANSFER: 'Przelew',
  // CARD: 'Karta',
}

export const COST_TYPES: TransferTypeT[] = ['INVESTMENT_EXPENSE', 'EMPLOYEE_EXPENSE', 'LABOR_COST']
export const INCOME_TYPES: TransferTypeT[] = ['INVESTOR_DEPOSIT']
export const INVESTMENT_TYPES: TransferTypeT[] = [...COST_TYPES, ...INCOME_TYPES]

export const isDepositType = (type: string) => (DEPOSIT_TYPES as readonly string[]).includes(type)

export const needsSourceRegister = (type: string) =>
  type !== 'EMPLOYEE_EXPENSE' && type !== 'LABOR_COST'

export const showsInvestment = (type: string) =>
  type === 'INVESTOR_DEPOSIT' ||
  type === 'INVESTMENT_EXPENSE' ||
  type === 'EMPLOYEE_EXPENSE' ||
  type === 'LABOR_COST'

export const requiresInvestment = (type: string) =>
  type === 'INVESTOR_DEPOSIT' || type === 'INVESTMENT_EXPENSE' || type === 'LABOR_COST'

export const needsWorker = (type: string) =>
  type === 'ACCOUNT_FUNDING' || type === 'EMPLOYEE_EXPENSE'

export const needsTargetRegister = (type: string) => type === 'REGISTER_TRANSFER'

export const needsOtherCategory = (type: string) => type === 'OTHER' || type === 'EMPLOYEE_EXPENSE'

export const isCancellationType = (type: string) => type === 'CANCELLATION'
