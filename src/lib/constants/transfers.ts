// Sorted alphabetically by Polish label
export const TRANSFER_TYPES = [
  'CANCELLATION', // Anulowanie
  'OTHER_DEPOSIT', // Inna wpłata
  'OTHER', // Inny wydatek
  'CORRECTION', // Korekta
  'LABOR_COST', // Koszty robocizny
  'RABAT', // Rabat
  'LOSS', // Strata
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
  RABAT: 'Rabat',
  LOSS: 'Strata',
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
  RABAT: 'chart-green',
  LOSS: 'chart-purple',
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
  'RABAT', // Rabat
  'LOSS', // Strata
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'PAYOUT', // Wypłata
]

// Investment-linked types mirrored on the sheet's 'transfery (tylko do odczytu)'
// tab — every showInvestment type (src/collections/transfers.ts) EXCEPT
// INVESTMENT_EXPENSE (owns the expenses tab) and CANCELLATION (audit row).
// Order = summary-block column order on the tab.
export const SHEET_TRANSFER_TAB_TYPES = [
  'INVESTOR_DEPOSIT',
  'LABOR_COST',
  'RABAT',
  'PAYOUT',
  'CORRECTION',
  'LOSS',
] as const satisfies readonly TransferTypeT[]
export type SheetTransferTabTypeT = (typeof SHEET_TRANSFER_TAB_TYPES)[number]

export const isSheetTransferTabType = (t: unknown): t is SheetTransferTabTypeT =>
  (SHEET_TRANSFER_TAB_TYPES as readonly string[]).includes(String(t))

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

const COST_TYPES: TransferTypeT[] = ['INVESTMENT_EXPENSE', 'LABOR_COST']
const INVESTMENT_TYPES: TransferTypeT[] = [
  ...COST_TYPES,
  ...DEPOSIT_TYPES,
  'RABAT',
  'LOSS',
  'CORRECTION',
  'PAYOUT',
]

// Subset of INVESTMENT_TYPES where the investment is mandatory (not just shown).
const REQUIRES_INVESTMENT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'INVESTMENT_EXPENSE',
  'LABOR_COST',
  'RABAT',
]

export const isTransferType = (type: string): type is TransferTypeT =>
  (TRANSFER_TYPES as readonly string[]).includes(type)

export const isDepositType = (type: string) =>
  isTransferType(type) && (DEPOSIT_TYPES as readonly string[]).includes(type)

export const needsSourceRegister = (type: string) =>
  isTransferType(type) && type !== 'LABOR_COST' && type !== 'RABAT' && type !== 'LOSS'

export const showsInvestment = (type: string) =>
  isTransferType(type) && (INVESTMENT_TYPES as readonly string[]).includes(type)

export const requiresInvestment = (type: string) =>
  isTransferType(type) && (REQUIRES_INVESTMENT_TYPES as readonly string[]).includes(type)

export const needsTargetRegister = (type: string) =>
  isTransferType(type) && type === 'REGISTER_TRANSFER'

export const needsWorker = (type: string) => isTransferType(type) && type === 'PAYOUT'

export const needsOtherCategory = (type: string) => isTransferType(type) && type === 'OTHER'

export const showsOtherCategory = (type: string) =>
  isTransferType(type) && (type === 'OTHER' || type === 'INVESTMENT_EXPENSE' || type === 'PAYOUT')

export const needsExpenseCategory = (type: string) =>
  isTransferType(type) && type === 'INVESTMENT_EXPENSE'

export const showsExpenseCategory = (type: string, hasInvestment?: boolean) =>
  needsExpenseCategory(type) || (isTransferType(type) && type === 'CORRECTION' && !!hasInvestment)

export const isLaborCost = (type: string) => isTransferType(type) && type === 'LABOR_COST'

export const isCancellationType = (type: string) => isTransferType(type) && type === 'CANCELLATION'
