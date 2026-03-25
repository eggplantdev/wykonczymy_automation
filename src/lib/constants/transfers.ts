// Sorted alphabetically by Polish label
export const TRANSFER_TYPES = [
  'CANCELLATION', // Anulowanie
  'OTHER_DEPOSIT', // Inna wpłata
  'OTHER', // Inny wydatek
  'CORRECTION', // Korekta
  'LABOR_COST', // Koszty robocizny
  'REGISTER_TRANSFER', // Transfer między kasami
  'INVESTOR_DEPOSIT', // Wpłata od inwestora
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'PAYOUT', // Wypłata
  'COMPANY_FUNDING', // Zasilenie z konta firmowego
] as const
export type TransferTypeT = (typeof TRANSFER_TYPES)[number]

export const TRANSFER_TYPE_LABELS: Record<TransferTypeT, string> = {
  INVESTOR_DEPOSIT: 'Wpłata od inwestora',
  COMPANY_FUNDING: 'Zasilenie z konta firmowego',
  OTHER_DEPOSIT: 'Inna wpłata',
  INVESTMENT_EXPENSE: 'Wydatek inwestycyjny',
  LABOR_COST: 'Koszty robocizny',
  CORRECTION: 'Korekta',
  PAYOUT: 'Wypłata',
  REGISTER_TRANSFER: 'Transfer między kasami',
  OTHER: 'Inny wydatek',
  CANCELLATION: 'Anulowanie',
}

export const TRANSFER_TYPE_COLORS: Record<TransferTypeT, string> = {
  INVESTOR_DEPOSIT: 'chart-green',
  COMPANY_FUNDING: 'chart-green',
  OTHER_DEPOSIT: 'chart-green',
  INVESTMENT_EXPENSE: 'chart-red',
  LABOR_COST: 'chart',
  CORRECTION: 'chart-orange',
  PAYOUT: 'chart-red',
  REGISTER_TRANSFER: 'chart-turquoise',
  OTHER: 'chart-red',
  CANCELLATION: 'muted-foreground',
}

export const EXPENSE_CATEGORY_LABEL = 'Typ wydatku inwestycyjnego'

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
  'OTHER', // Inny wydatek
  'CORRECTION', // Korekta
  'LABOR_COST', // Koszty robocizny
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'PAYOUT', // Wypłata
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

export const COST_TYPES: TransferTypeT[] = ['INVESTMENT_EXPENSE', 'LABOR_COST']
export const INVESTMENT_TYPES: TransferTypeT[] = [
  ...COST_TYPES,
  ...DEPOSIT_TYPES,
  'PAYOUT',
  'CORRECTION',
]

export const isTransferType = (type: string): type is TransferTypeT =>
  (TRANSFER_TYPES as readonly string[]).includes(type)

export const isDepositType = (type: string) =>
  isTransferType(type) && (DEPOSIT_TYPES as readonly string[]).includes(type)

export const needsSourceRegister = (type: string) => isTransferType(type) && type !== 'LABOR_COST'

export const showsInvestment = (type: string) =>
  isTransferType(type) && (INVESTMENT_TYPES as readonly string[]).includes(type)

export const requiresInvestment = (type: string) =>
  isTransferType(type) &&
  (type === 'INVESTOR_DEPOSIT' || type === 'INVESTMENT_EXPENSE' || type === 'LABOR_COST')

export const needsTargetRegister = (type: string) =>
  isTransferType(type) && type === 'REGISTER_TRANSFER'

export const needsOtherCategory = (type: string) => isTransferType(type) && type === 'OTHER'

export const showsOtherCategory = (type: string) =>
  isTransferType(type) && (type === 'OTHER' || type === 'INVESTMENT_EXPENSE')

export const needsExpenseCategory = (type: string) =>
  isTransferType(type) && type === 'INVESTMENT_EXPENSE'

export const showsExpenseCategory = (type: string) =>
  needsExpenseCategory(type) || (isTransferType(type) && type === 'CORRECTION')

export const isCancellationType = (type: string) => isTransferType(type) && type === 'CANCELLATION'
