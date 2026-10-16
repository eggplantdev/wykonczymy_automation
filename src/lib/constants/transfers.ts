// Sorted alphabetically by Polish label
export const TRANSFER_TYPES = [
  'CANCELLATION', // Anulowanie
  'OTHER_DEPOSIT', // Inna wpłata
  'OTHER', // Inny wydatek
  'CORRECTION', // Korekta
  'LABOR_COST', // Koszty robocizny
  'BONUS', // Premia
  'RABAT', // Rabat
  'LOSS', // Strata
  'REGISTER_TRANSFER', // Transfer między kasami
  'INVESTOR_DEPOSIT', // Wpłata od inwestora
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'INVESTMENT_EXPENSE_NET', // Wydatek inwestycyjny netto
  'PAYOUT', // Wypłata
  'COMPANY_FUNDING', // Zasilenie z konta firmowego
] as const
export type TransferTypeT = (typeof TRANSFER_TYPES)[number]

type TransferSpecT = {
  label: string
  color: string
  /** Adds to a register instead of subtracting, and counts as investor income. */
  deposit: boolean
  expensesSheetTab: boolean
  transfersSheetTab: boolean
  settleable: boolean
  /**
   * `'materialsNet'` is a bucket of its own, NOT a flavour of `'materials'`: its rows are
   * already netto, so the global kosztorys „wszystko netto" toggle must never reach them.
   *
   * `'bonus'` is its own bucket, never `'loss'` or `'discount'`: those two lower the
   * investor's bilans and print on the protokół, and a premia must reach neither.
   */
  financialBucket:
    | 'materials'
    | 'materialsNet'
    | 'income'
    | 'laborCosts'
    | 'payouts'
    | 'discount'
    | 'loss'
    | 'bonus'
    | 'none'
  billedAmount: 'amount' | 'netAmount'
  sourceRegister: 'required' | 'never'
}

export type FinancialBucketT = TransferSpecT['financialBucket']

export const TRANSFER_TYPE_SPECS = {
  CANCELLATION: {
    label: 'Anulowanie',
    color: 'muted-foreground',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'none',
    billedAmount: 'amount',
    // A register set here would reach the `ELSE
    // -amount` arm in sum-transfers and silently drain that register.
    sourceRegister: 'never',
  },
  OTHER_DEPOSIT: {
    label: 'Inna wpłata',
    color: 'section-teal',
    deposit: true,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'income',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  OTHER: {
    label: 'Inny wydatek',
    color: 'transfer-red-warm',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'none',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  CORRECTION: {
    label: 'Korekta',
    color: 'section-orange',
    deposit: false,
    expensesSheetTab: true,
    transfersSheetTab: false,
    settleable: true,
    financialBucket: 'materials',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  LABOR_COST: {
    label: 'Koszty robocizny',
    color: 'section-orange-deep',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: true,
    settleable: false,
    financialBucket: 'laborCosts',
    billedAmount: 'amount',
    sourceRegister: 'never',
  },
  BONUS: {
    label: 'Premia',
    color: 'section-yellow',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'bonus',
    billedAmount: 'amount',
    sourceRegister: 'never',
  },
  RABAT: {
    label: 'Rabat',
    color: 'section-yellow-deep',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: true,
    settleable: false,
    financialBucket: 'discount',
    billedAmount: 'amount',
    sourceRegister: 'never',
  },
  LOSS: {
    label: 'Strata',
    color: 'section-purple',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: true,
    settleable: false,
    financialBucket: 'loss',
    billedAmount: 'amount',
    sourceRegister: 'never',
  },
  REGISTER_TRANSFER: {
    label: 'Transfer między kasami',
    color: 'section-turquoise',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'none',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  INVESTOR_DEPOSIT: {
    label: 'Wpłata od inwestora',
    color: 'section-green',
    deposit: true,
    expensesSheetTab: false,
    transfersSheetTab: true,
    settleable: false,
    financialBucket: 'income',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  INVESTMENT_EXPENSE: {
    label: 'Wydatek inwestycyjny',
    color: 'section-red',
    deposit: false,
    expensesSheetTab: true,
    transfersSheetTab: false,
    settleable: true,
    financialBucket: 'materials',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  INVESTMENT_EXPENSE_NET: {
    label: 'Wydatek inwestycyjny netto',
    color: 'transfer-red-dark',
    deposit: false,
    expensesSheetTab: true,
    transfersSheetTab: false,
    // „wliczone w robociznę" would route its amount into totalSettled, which marża reads — and the netto figure
    // must never reach marża.
    settleable: false,
    financialBucket: 'materialsNet',
    billedAmount: 'netAmount',
    sourceRegister: 'required',
  },
  PAYOUT: {
    label: 'Wypłata',
    color: 'section-red-deep',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: true,
    settleable: false,
    financialBucket: 'payouts',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
  COMPANY_FUNDING: {
    label: 'Zasilenie z konta firmowego',
    color: 'section-green-deep',
    deposit: true,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'income',
    billedAmount: 'amount',
    sourceRegister: 'required',
  },
} satisfies Record<TransferTypeT, TransferSpecT>

const mapSpecs = <V>(pick: (spec: TransferSpecT) => V): Record<TransferTypeT, V> =>
  Object.fromEntries(TRANSFER_TYPES.map((t) => [t, pick(TRANSFER_TYPE_SPECS[t])])) as Record<
    TransferTypeT,
    V
  >

export const TRANSFER_TYPE_LABELS: Record<TransferTypeT, string> = mapSpecs((s) => s.label)

export const TRANSFER_TYPE_COLORS: Record<TransferTypeT, string> = mapSpecs((s) => s.color)

export const transferColorVar = ({ type, settled }: { type: TransferTypeT; settled?: boolean }) =>
  `var(--color-${settled ? SETTLED_TYPE.color : TRANSFER_TYPE_COLORS[type]})`

export const EXPENSE_CATEGORY_LABEL = 'Typ wydatku inwestycyjnego'

export const DEFAULT_EXPENSE_CATEGORY_NAME = 'Materiały budowlane'

export const SETTLED_TYPE = {
  label: 'Materiały wliczone w robociznę',
  color: 'transfer-fuchsia',
} as const

export const DEPOSIT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'COMPANY_FUNDING',
  'OTHER_DEPOSIT',
]

export const DEPOSIT_UI_TYPES: TransferTypeT[] = [
  'OTHER_DEPOSIT',
  'INVESTOR_DEPOSIT',
  'COMPANY_FUNDING',
]

// TEMPORARY — EX-712 removes both entries again once the rozjazd between the two is zero everywhere.
export const TRANSACTION_TRANSFER_TYPES: TransferTypeT[] = [
  'OTHER', // Inny wydatek
  'CORRECTION', // Korekta
  'LABOR_COST', // Koszty robocizny
  'BONUS', // Premia
  'RABAT', // Rabat
  'LOSS', // Strata
  'INVESTMENT_EXPENSE', // Wydatek inwestycyjny
  'INVESTMENT_EXPENSE_NET', // Wydatek inwestycyjny netto
  'PAYOUT', // Wypłata
]

// Stays a literal because it exports SheetTransferTabTypeT — deriving it with a
// .filter() destroys the literal union.
export const SHEET_TRANSFER_TAB_TYPES = [
  'INVESTOR_DEPOSIT',
  'LABOR_COST',
  'RABAT',
  'PAYOUT',
  'LOSS',
] as const satisfies readonly TransferTypeT[]
export type SheetTransferTabTypeT = (typeof SHEET_TRANSFER_TAB_TYPES)[number]

export const EXPENSES_TAB_TYPES = [
  'INVESTMENT_EXPENSE',
  'INVESTMENT_EXPENSE_NET',
  'CORRECTION',
] as const satisfies readonly TransferTypeT[]

// It's ALSO the
// SUMIF criterion, so it must match no real `typ` value → totals 0.
export const CORRECTION_MOVED_LABEL = 'Korekta → wydatki inwest.'

// CORRECTION keeps its original 5th slot: dropping the column would shift LOSS left and break
// sheet formulas keyed to a fixed column position. Order = column order on the tab.
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

export const PAYMENT_METHOD_PLANE_LABELS: Record<PaymentMethodT, string> = {
  CASH: 'Gotówka netto',
  TRANSFER: 'Przelew brutto',
}

export const planeFor = (type: unknown, paymentMethod: unknown): VatPlaneT =>
  type === 'INVESTOR_DEPOSIT' && paymentMethod === 'TRANSFER' ? 'GROSS' : 'NET'

// Downstream (deposits reconciliation) an unmarked deposit is treated as netto — the owner's
// „brak wartości = netto" ruling.
export const VAT_PLANES = ['NET', 'GROSS'] as const
export type VatPlaneT = (typeof VAT_PLANES)[number]

export const isVatPlane = (value: string | undefined): value is VatPlaneT =>
  VAT_PLANES.includes(value as VatPlaneT)

export const VAT_PLANE_LABELS: Record<VatPlaneT, string> = {
  NET: 'Netto',
  GROSS: 'Brutto',
}

export const DEPOSIT_PLANE_LABELS: Record<VatPlaneT, string> = {
  NET: 'Gotówka',
  GROSS: 'Przelew',
}

export const DEPOSIT_PLANE_INSTRUMENTAL: Record<VatPlaneT, string> = {
  NET: 'gotówką',
  GROSS: 'przelewem',
}

// Every value here must stay eager. sync-sheet.ts spreads these arrays at module load
// inside the Payload config graph; a lazy value would yield [] there and every transfer
// would silently stop syncing to the sheet.

export const isTransferType = (type: string): type is TransferTypeT =>
  (TRANSFER_TYPES as readonly string[]).includes(type)

const specOf = (type: unknown): TransferSpecT | undefined =>
  typeof type === 'string' && isTransferType(type) ? TRANSFER_TYPE_SPECS[type] : undefined

export const isDepositType = (type: string) => specOf(type)?.deposit === true

export const isExpensesTabType = (type: unknown): boolean => specOf(type)?.expensesSheetTab === true

export const canBeSettled = (type: unknown): boolean => specOf(type)?.settleable === true

export const isSheetTransferTabType = (type: unknown): type is SheetTransferTabTypeT =>
  specOf(type)?.transfersSheetTab === true

export const needsSourceRegister = (type: string) => specOf(type)?.sourceRegister === 'required'

// An unknown type contributes to nothing rather than throwing — a row whose type predates
// the union must not take the whole investment panel down with it.
export const financialBucketOf = (type: unknown): FinancialBucketT =>
  specOf(type)?.financialBucket ?? 'none'

// An unknown type answers `amount` — the column every row has — so a stale type can never sum a
// NULL column into a silent zero.
export const billedAmountOf = (type: unknown): 'amount' | 'netAmount' =>
  specOf(type)?.billedAmount ?? 'amount'

export const billsNetAmount = (type: unknown): boolean => billedAmountOf(type) === 'netAmount'

export const carriesNetAmount = (type: unknown, vatPlane: unknown): boolean =>
  billsNetAmount(type) || (type === 'INVESTOR_DEPOSIT' && vatPlane === 'GROSS')

export const carriesVatPlane = (type: unknown): boolean => type === 'INVESTOR_DEPOSIT'

// Every other type stores null rather than a preselected „Gotówka" nobody
// chose — the column and the filter are read as answers, so a default would make „Gotówka" mean
// „gotówka albo nikt nie pytał" and the filter untrustworthy.
export const carriesPaymentMethod = (type: unknown): boolean =>
  type === 'INVESTOR_DEPOSIT' || type === 'INVESTMENT_EXPENSE_NET'

export const carriesPayoutStatus = (type: unknown): boolean => type === 'PAYOUT'

export const canFillVatPlane = (row: { type?: unknown; vatPlane?: unknown }): boolean =>
  carriesVatPlane(row.type) && row.vatPlane == null

/**
 * A netto row missing its netAmount bills 0 rather than falling back to brutto: the write path
 * guarantees the column (hooks/transfers/validate.ts), and a silent brutto fallback would be the
 * exact over-billing this type exists to prevent.
 */
export const billedAmountFor = (
  type: unknown,
  amount: number,
  netAmount: number | null | undefined,
): number => (billsNetAmount(type) ? (netAmount ?? 0) : amount)

// COMPANY_FUNDING and OTHER_DEPOSIT are company-level cash, never
// client-level, so an investment on them would silently move that investment's bilans.
const INVESTMENT_TYPES: TransferTypeT[] = [
  'INVESTMENT_EXPENSE',
  'INVESTMENT_EXPENSE_NET',
  'LABOR_COST',
  'INVESTOR_DEPOSIT',
  'RABAT',
  'LOSS',
  'CORRECTION',
  'PAYOUT',
  'BONUS',
]

const REQUIRES_INVESTMENT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'INVESTMENT_EXPENSE',
  'INVESTMENT_EXPENSE_NET',
  'LABOR_COST',
  'RABAT',
  'LOSS',
  'BONUS',
]

export const showsInvestment = (type: string) =>
  isTransferType(type) && (INVESTMENT_TYPES as readonly string[]).includes(type)

export const requiresInvestment = (type: string) =>
  isTransferType(type) && (REQUIRES_INVESTMENT_TYPES as readonly string[]).includes(type)

export const needsTargetRegister = (type: string) =>
  isTransferType(type) && type === 'REGISTER_TRANSFER'

export const needsWorker = (type: string) =>
  isTransferType(type) && (type === 'PAYOUT' || type === 'BONUS')

// An OTHER names who bought it: the one worker that may change after save.
export const hasOptionalWorker = (type: string) => isTransferType(type) && type === 'OTHER'

export const showsWorker = (type: string) => needsWorker(type) || hasOptionalWorker(type)

export const needsOtherCategory = (type: string) => isTransferType(type) && type === 'OTHER'

export const isInvestmentExpense = (type: string) =>
  type === 'INVESTMENT_EXPENSE' || type === 'INVESTMENT_EXPENSE_NET'

export const showsOtherCategory = (type: string) =>
  isTransferType(type) && (type === 'OTHER' || isInvestmentExpense(type) || type === 'PAYOUT')

export const needsExpenseCategory = (type: string, hasInvestment?: boolean) =>
  isTransferType(type) && (isInvestmentExpense(type) || (type === 'CORRECTION' && !!hasInvestment))

export const isLaborCost = (type: string) => isTransferType(type) && type === 'LABOR_COST'

export const isCancellationType = (type: string) => isTransferType(type) && type === 'CANCELLATION'
