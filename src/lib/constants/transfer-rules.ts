import {
  TRANSFER_TYPES,
  DEPOSIT_TYPES,
  EXPENSES_TAB_TYPES,
  SHEET_TRANSFER_TAB_TYPES,
  type TransferTypeT,
  type SheetTransferTabTypeT,
} from './transfers'

// Membership arrays are spelled out as literals (not spread from DEPOSIT_TYPES) because
// this module is pulled in by the re-export barrel in transfers.ts before that file has
// finished initializing its arrays — spreading them at load time reads `undefined`.
// The isDepositType predicate still reads DEPOSIT_TYPES, but only lazily at call time.

export const isSheetTransferTabType = (t: unknown): t is SheetTransferTabTypeT =>
  (SHEET_TRANSFER_TAB_TYPES as readonly string[]).includes(String(t))

export const isExpensesTabType = (t: unknown): boolean =>
  (EXPENSES_TAB_TYPES as readonly string[]).includes(String(t))

// The "wliczone w robociznę" (settled) flag applies to exactly the material-expense
// types — the same membership as the expenses tab. Reuses the one array so the form,
// action, collection condition, validate hook and reporting math can't drift apart.
export const canBeSettled = (t: unknown): boolean => isExpensesTabType(t)

const INVESTMENT_TYPES: TransferTypeT[] = [
  'INVESTMENT_EXPENSE',
  'LABOR_COST',
  'INVESTOR_DEPOSIT',
  'COMPANY_FUNDING',
  'OTHER_DEPOSIT',
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

export const needsExpenseCategory = (type: string, hasInvestment?: boolean) =>
  isTransferType(type) &&
  (type === 'INVESTMENT_EXPENSE' || (type === 'CORRECTION' && !!hasInvestment))

export const isLaborCost = (type: string) => isTransferType(type) && type === 'LABOR_COST'

export const isCancellationType = (type: string) => isTransferType(type) && type === 'CANCELLATION'
