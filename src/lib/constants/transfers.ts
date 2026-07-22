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
  LABOR_COST: 'chart-orange',
  RABAT: 'chart-green',
  LOSS: 'chart-purple',
  CORRECTION: 'chart-orange',
  PAYOUT: 'chart-red',
  REGISTER_TRANSFER: 'chart-turquoise',
  OTHER: 'chart-red',
  CANCELLATION: 'muted-foreground',
}

export const EXPENSE_CATEGORY_LABEL = 'Typ wydatku inwestycyjnego'

// Single source for the settled INVESTMENT_EXPENSE (material priced into robocizna):
// label + chart color, shared by the transfers table and the investment stats panel so they never drift.
// `color` is a chart token (resolved via var(--color-<token>)); chart-pink keeps it distinct from korekta (orange).
export const SETTLED_TYPE = {
  label: 'Materiały wliczone w robociznę',
  color: 'chart-pink',
} as const

export const DEPOSIT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'COMPANY_FUNDING',
  'OTHER_DEPOSIT',
]

// Deposit types visible in the deposit dialog (sorted by Polish label). „Inna wpłata" is dropped
// (EX-536); the netto/brutto plane applies to INVESTOR_DEPOSIT only — COMPANY_FUNDING hides it.
export const DEPOSIT_UI_TYPES: TransferTypeT[] = ['INVESTOR_DEPOSIT', 'COMPANY_FUNDING']

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
  'LOSS',
] as const satisfies readonly TransferTypeT[]
export type SheetTransferTabTypeT = (typeof SHEET_TRANSFER_TAB_TYPES)[number]

// Types that own a row on the kosztorys "Wydatki inwestycyjne" tab. Single source
// of truth for sheet routing AND the sync-hook gate — keep them from drifting
// apart (a CORRECTION once synced to no tab because one of three copies was missed).
export const EXPENSES_TAB_TYPES = [
  'INVESTMENT_EXPENSE',
  'CORRECTION',
] as const satisfies readonly TransferTypeT[]

// Placeholder label for the retired Korekta summary column. Corrections now live
// on the expenses tab, but the column stays so sheet formulas keyed to a fixed
// position don't shift; the label signals where corrections went. It's ALSO the
// SUMIF criterion, so it must match no real `typ` value (it never will) → totals 0.
export const CORRECTION_MOVED_LABEL = 'Korekta → wydatki inwest.'

// Per-type SUMIF summary columns on the transfers tab — a FIXED layout, decoupled
// from data routing (SHEET_TRANSFER_TAB_TYPES). CORRECTION keeps its original 5th
// slot even though corrections now route to the expenses tab (its SUMIF totals 0
// here): the summary block is rebuilt verbatim by setupTab on a reset/relink, and
// dropping the column would shift LOSS left and break sheet formulas keyed to a
// fixed column position. Order = column order on the tab.
export const TRANSFERS_SUMMARY_TYPES = [
  'INVESTOR_DEPOSIT',
  'LABOR_COST',
  'RABAT',
  'PAYOUT',
  'CORRECTION',
  'LOSS',
] as const satisfies readonly TransferTypeT[]

export const PAYMENT_METHODS = [
  'CASH',
  'TRANSFER',
  // 'BLIK',
  // 'CARD',
] as const
export type PaymentMethodT = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodT, string> = {
  CASH: 'Gotówka',
  TRANSFER: 'Przelew',
  // BLIK: 'BLIK',
  // CARD: 'Karta',
}

// EX-536 netto/brutto wpłata bucket. A NULL third state (legacy deposits) exists in the DB
// but is never a selectable choice — the create form forces one of these two.
export const VAT_PLANES = ['NET', 'GROSS'] as const
export type VatPlaneT = (typeof VAT_PLANES)[number]

export const VAT_PLANE_LABELS: Record<VatPlaneT, string> = {
  NET: 'Netto',
  GROSS: 'Brutto',
}

// Type predicates and their private membership arrays live in transfer-rules.ts to
// keep this file to plain data. Re-exported here so existing importers stay unchanged;
// the transfers ↔ transfer-rules cycle is safe because predicates access these arrays
// lazily at call time, not at module load.
export {
  isSheetTransferTabType,
  isExpensesTabType,
  canBeSettled,
  isTransferType,
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  requiresInvestment,
  needsTargetRegister,
  needsWorker,
  needsOtherCategory,
  showsOtherCategory,
  needsExpenseCategory,
  isLaborCost,
  isCancellationType,
} from './transfer-rules'
