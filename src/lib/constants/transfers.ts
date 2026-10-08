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

/**
 * What a transfer type DOES — one row per type, one column per decision.
 *
 * The axis used to run the other way: a dozen membership arrays each answering "which
 * types belong to me", so adding a type meant visiting each one and remembering to
 * consider it. A miss was a silently wrong number, never a build error. `satisfies
 * Record<TransferTypeT, …>` inverts that — a new type cannot compile until every column
 * below has an answer.
 *
 * Deliberately narrow: only decisions where getting it wrong moves money or misroutes a
 * sheet row. Per-field form rules (which fields show, which are required, which are
 * auto-cleared) are five independent axes per field, not one membership question, and
 * stay as their own predicates below.
 */
type TransferSpecT = {
  label: string
  color: string
  /** Adds to a register instead of subtracting, and counts as investor income. */
  deposit: boolean
  /** Owns a row on the kosztorys „Wydatki inwestycyjne" tab. */
  expensesSheetTab: boolean
  /** Owns a row on the „transfery (tylko do odczytu)" tab. */
  transfersSheetTab: boolean
  /**
   * The „wliczone w robociznę" flag means something for this type.
   *
   * It was equal to `expensesSheetTab` for all twelve pre-netto types — which is exactly
   * why the two were once a single predicate. INVESTMENT_EXPENSE_NET ended that: it owns
   * an expenses-tab row but is NOT settleable, because collapsing them leaks netto into
   * totalSettled → marża.
   */
  settleable: boolean
  /**
   * Which investment figure this type feeds. `'none'` means it feeds none — an explicit
   * answer, so a type that falls into no bucket is a stated decision rather than a
   * `deriveFinancials` that simply forgot to mention it.
   *
   * `'materials'` splits further on the `settled` flag: unsettled → totalMaterialCosts,
   * settled → totalSettled. That split lives in deriveFinancials, not here, because it
   * is a per-ROW fact, not a per-type one.
   *
   * `'materialsNet'` is a bucket of its own, NOT a flavour of `'materials'`: its rows are
   * already netto, so the global kosztorys „wszystko netto" toggle must never reach them.
   * Keeping it out of the number the toggle multiplies makes the double cut structurally
   * impossible, instead of an `if` someone has to remember.
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
  /**
   * Which stored column bills the investor. Every type but the netto expense bills at
   * `amount`; INVESTMENT_EXPENSE_NET leaves the register at `amount` (brutto) and bills
   * at `netAmount`. Separate from `financialBucket` — that says WHICH figure a type
   * feeds, this says WHICH number it feeds it with.
   */
  billedAmount: 'amount' | 'netAmount'
  /** Whether a source register is required, or meaningless (a P&L figure, no cash moves). */
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
    // A cancellation moves no cash of its own — it annotates the row it reverses, whose
    // register already carries the reversal. A register set here would reach the `ELSE
    // -amount` arm in sum-transfers and silently drain that register.
    sourceRegister: 'never',
  },
  OTHER_DEPOSIT: {
    label: 'Inna wpłata',
    color: 'chart-green',
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
    color: 'chart-red',
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
    color: 'chart-orange',
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
    color: 'chart-orange',
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
    color: 'chart-yellow',
    deposit: false,
    expensesSheetTab: false,
    transfersSheetTab: false,
    settleable: false,
    financialBucket: 'bonus',
    billedAmount: 'amount',
    // An entitlement on an investment × worker pair, not cash — the money itself leaves as a
    // PAYOUT, which already debits its kasa.
    sourceRegister: 'never',
  },
  RABAT: {
    label: 'Rabat',
    color: 'chart-green',
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
    color: 'chart-purple',
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
    color: 'chart-turquoise',
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
    color: 'chart-green',
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
    color: 'chart-red',
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
    color: 'chart-blue',
    deposit: false,
    // Shares routing, category and sheet-sync with the brutto expense — only the money
    // differs.
    expensesSheetTab: true,
    transfersSheetTab: false,
    // The one column that separates it from INVESTMENT_EXPENSE: „wliczone w robociznę"
    // would route its amount into totalSettled, which marża reads — and the netto figure
    // must never reach marża.
    settleable: false,
    financialBucket: 'materialsNet',
    billedAmount: 'netAmount',
    sourceRegister: 'required',
  },
  PAYOUT: {
    label: 'Wypłata',
    color: 'chart-red',
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
    color: 'chart-green',
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

export const EXPENSE_CATEGORY_LABEL = 'Typ wydatku inwestycyjnego'

// Matched by NAME against the `expense-categories` rows, because the collection carries no
// "is default" flag — roughly 99% of expenses are this one (owner, 2026-08-27), so pre-picking it
// beats making the user choose every time. Renaming the row in /admin only makes the resolve miss
// and the field open blank, i.e. today's behaviour — never a wrong category.
export const DEFAULT_EXPENSE_CATEGORY_NAME = 'Materiały budowlane'

// Single source for the settled INVESTMENT_EXPENSE (material priced into robocizna):
// label + chart color, shared by the transfers table and the investment stats panel so they never drift.
// `color` is a chart token (resolved via var(--color-<token>)); chart-pink keeps it distinct from korekta (orange).
export const SETTLED_TYPE = {
  label: 'Materiały wliczone w robociznę',
  color: 'chart-pink',
} as const

// Bound to the table's `deposit` column by the consistency test. Kept as an explicit
// array because it is spread into SQL IN-lists at module load.
export const DEPOSIT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'COMPANY_FUNDING',
  'OTHER_DEPOSIT',
]

// Deposit types visible in the deposit dialog (sorted by Polish label). „Inna wpłata" is the type
// for cash entering a register without an investment — EX-536 took the investment away from it, not
// the type, and EX-557 restores it. The netto/brutto plane still applies to INVESTOR_DEPOSIT only.
export const DEPOSIT_UI_TYPES: TransferTypeT[] = [
  'OTHER_DEPOSIT',
  'INVESTOR_DEPOSIT',
  'COMPANY_FUNDING',
]

// Transfer types visible in the transaction transfer dialog (sorted by Polish label).
//
// „Koszty robocizny" and „Rabat" left this list in EX-555 (read them off the kosztorys, booking one
// by hand double-counts) and came back in EX-649, because that reasoning holds only once an
// investment's kosztorys is IN the app. While it is still a spreadsheet there is no third option:
// the dialog refuses the booking and `readingFromKosztorys` returns 0 zl, so the investment cannot
// be settled at all and its bilans renders as if no robocizna existed.
//
// So both are offerable again for EVERY investment, with no gating — double-counting is made VISIBLE
// rather than prevented, by the „Robocizna v1 / v2" columns on the
// listing and by the v2 reconciliation, which now has something to reconcile against.
//
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

// Investment-linked types mirrored on the sheet's 'transfery (tylko do odczytu)'
// tab. Stays a literal because it exports SheetTransferTabTypeT — deriving it with a
// .filter() destroys the literal union. Membership is bound to the table's
// `transfersSheetTab` column by the consistency test.
// (Order is NOT the summary-block column order — that is TRANSFERS_SUMMARY_TYPES.
// This array is only ever used in `{ in: [...] }` wheres and .includes(), so it is
// order-free.)
export const SHEET_TRANSFER_TAB_TYPES = [
  'INVESTOR_DEPOSIT',
  'LABOR_COST',
  'RABAT',
  'PAYOUT',
  'LOSS',
] as const satisfies readonly TransferTypeT[]
export type SheetTransferTabTypeT = (typeof SHEET_TRANSFER_TAB_TYPES)[number]

// Types that own a row on the kosztorys "Wydatki inwestycyjne" tab. Stays a literal
// because sync-sheet.ts spreads it at module load inside the Payload config graph, which
// needs an eager value. Membership is bound to the table's `expensesSheetTab` column by
// the consistency test.
export const EXPENSES_TAB_TYPES = [
  'INVESTMENT_EXPENSE',
  'INVESTMENT_EXPENSE_NET',
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

// On a wpłata od inwestora the method IS the plane (see `planeFor`), so the select names the kwota
// that is about to be typed. Everywhere else the method is only the tor.
export const PAYMENT_METHOD_PLANE_LABELS: Record<PaymentMethodT, string> = {
  CASH: 'Gotówka netto',
  TRANSFER: 'Przelew brutto',
}

// Gotówka is the no-VAT tor, przelew the invoiced one — so the method IS the plane, and the wpłata
// is typed on the side it names. Keyed on the type too: every other type renders one kwota, and a
// GROSS tag on it would demand a brutto field that is not on screen.
export const planeFor = (type: unknown, paymentMethod: unknown): VatPlaneT =>
  type === 'INVESTOR_DEPOSIT' && paymentMethod === 'TRANSFER' ? 'GROSS' : 'NET'

// EX-536 netto/brutto wpłata bucket. The create form now always sends NET or GROSS (NET preselected),
// but NULL stays a valid stored state for wpłaty booked before that. Downstream (deposits
// reconciliation) an unmarked deposit is treated as netto — the owner's „brak wartości = netto"
// ruling (flipped 2026-07-23 from the earlier null→brutto default; only GROSS goes to the invoiced
// part, NET and null pay gotówka).
export const VAT_PLANES = ['NET', 'GROSS'] as const
export type VatPlaneT = (typeof VAT_PLANES)[number]

export const isVatPlane = (value: string | undefined): value is VatPlaneT =>
  VAT_PLANES.includes(value as VatPlaneT)

export const VAT_PLANE_LABELS: Record<VatPlaneT, string> = {
  NET: 'Netto',
  GROSS: 'Brutto',
}

// How a wpłata's plane is NAMED to the owner (2026-08-23). The stored value is unchanged; what
// changed is that „netto"/„brutto" named two different things on one screen — the plane the whole
// bill is settled in, and the tor this one wpłata arrived by — and the reader had to work out which
// from context. The tag answers the second, so it says the thing the owner can actually see on the
// wyciąg. Deliberately not read off `paymentMethod`: the plane is what the settlement uses, and a
// legacy row can carry a method that never picked one (BLIK / karta are off the form).
export const DEPOSIT_PLANE_LABELS: Record<VatPlaneT, string> = {
  NET: 'Gotówka',
  GROSS: 'Przelew',
}

// The same two in the instrumental — „2 wpłaty są gotówką". A label map cannot carry a case and
// Polish gives no helper for one.
export const DEPOSIT_PLANE_INSTRUMENTAL: Record<VatPlaneT, string> = {
  NET: 'gotówką',
  GROSS: 'przelewem',
}

// ── Predicates ──────────────────────────────────────────────────────────
//
// Every value here must stay eager. sync-sheet.ts spreads these arrays at module load
// inside the Payload config graph; a lazy value would yield [] there and every transfer
// would silently stop syncing to the sheet. (A barrel re-export, not the split, is what
// once made this file cycle — so a second home buys nothing.)

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

// Does this type bill at the netto column? Every consumer that reads a billed figure, renders
// the netto beside the brutto, or gates the netto input asks exactly this — as a named predicate
// so `'netAmount'` stays a spec-table detail instead of a literal spread across three layers.
export const billsNetAmount = (type: unknown): boolean => billedAmountOf(type) === 'netAmount'

// Does this row STORE a netto figure beside `amount`? Two unrelated reasons, deliberately one
// predicate, because the write path only cares whether the column is populated or nulled: a netto
// wydatek is BILLED at netto, and a wpłata brutto carries the netto its faktura names. The wpłata's
// netto is read, never derived — a bill built at two stawki has no single rate to cross it with
// (see `lib/kosztorys/deposit-planes.ts`).
export const carriesNetAmount = (type: unknown, vatPlane: unknown): boolean =>
  billsNetAmount(type) || (type === 'INVESTOR_DEPOSIT' && vatPlane === 'GROSS')

// Does this row STORE a netto/brutto plane? The tag names the side of the settlement a wpłata pays,
// so only a wpłata od inwestora has one — tagged onto any other type it would be a value every
// settlement predicate reads, with no second kwota on the form to back it.
export const carriesVatPlane = (type: unknown): boolean => type === 'INVESTOR_DEPOSIT'

// Does this row STORE a payment method? Asked only where it answers something: on a wpłata od
// inwestora the method IS the plane (`planeFor`), and on a wydatek inwestycyjny netto it records how
// the faktura was paid. Every other type stores null rather than a preselected „Gotówka" nobody
// chose — the column and the filter are read as answers, so a default would make „Gotówka" mean
// „gotówka albo nikt nie pytał" and the filter untrustworthy.
export const carriesPaymentMethod = (type: unknown): boolean =>
  type === 'INVESTOR_DEPOSIT' || type === 'INVESTMENT_EXPENSE_NET'

// The one row an edit may still tag: a wpłata booked before the plane existed. Named once because
// three places ask it — the form offering the question, the payload carrying the answer, the action
// letting it through — and they may not drift apart.
export const canFillVatPlane = (row: { type?: unknown; vatPlane?: unknown }): boolean =>
  carriesVatPlane(row.type) && row.vatPlane == null

/**
 * The figure this row bills the investor — the one number every billing surface must read, so the
 * app's totals, the „Wydatki inwestycyjne" list and the owner's sheet can't disagree about what a
 * netto row costs the client.
 *
 * A netto row missing its netAmount bills 0 rather than falling back to brutto: the write path
 * guarantees the column (hooks/transfers/validate.ts), and a silent brutto fallback would be the
 * exact over-billing this type exists to prevent.
 */
export const billedAmountFor = (
  type: unknown,
  amount: number,
  netAmount: number | null | undefined,
): number => (billsNetAmount(type) ? (netAmount ?? 0) : amount)

// Field-rule predicates. NOT folded into the table: a field is governed by up to five
// independent axes (shown / required / auto-cleared / optional / exempt), and `investment`
// alone uses three of them over two different type sets. One boolean column per predicate
// would be wrong by construction.

// COMPANY_FUNDING and OTHER_DEPOSIT left this set in EX-557: both are company-level cash, never
// client-level, so an investment on them would silently move that investment's bilans. Membership
// here is what the edit dialog, the Payload admin and the validate hook's auto-clear all read.
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

// Subset of INVESTMENT_TYPES where the investment is mandatory (not just shown).
const REQUIRES_INVESTMENT_TYPES: TransferTypeT[] = [
  'INVESTOR_DEPOSIT',
  'INVESTMENT_EXPENSE',
  'INVESTMENT_EXPENSE_NET',
  'LABOR_COST',
  'RABAT',
  // Mandatory since EX-675, when a strata started lowering the investor's bilans: an unlinked one
  // would be a concession credited to nobody.
  'LOSS',
  // A premia settles one investment × worker pair; one without an investment is a PAYOUT (owner,
  // EX-979).
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

// An OTHER names who bought it: optional, and the one worker that may change after save.
export const hasOptionalWorker = (type: string) => isTransferType(type) && type === 'OTHER'

export const showsWorker = (type: string) => needsWorker(type) || hasOptionalWorker(type)

export const needsOtherCategory = (type: string) => isTransferType(type) && type === 'OTHER'

// Brutto and netto investment expense differ only in which amount bills the investor —
// every form-field rule below treats them as one type.
const isInvestmentExpense = (type: string) =>
  type === 'INVESTMENT_EXPENSE' || type === 'INVESTMENT_EXPENSE_NET'

export const showsOtherCategory = (type: string) =>
  isTransferType(type) && (type === 'OTHER' || isInvestmentExpense(type) || type === 'PAYOUT')

export const needsExpenseCategory = (type: string, hasInvestment?: boolean) =>
  isTransferType(type) && (isInvestmentExpense(type) || (type === 'CORRECTION' && !!hasInvestment))

export const isLaborCost = (type: string) => isTransferType(type) && type === 'LABOR_COST'

export const isCancellationType = (type: string) => isTransferType(type) && type === 'CANCELLATION'
