import type { TransferTypeT, PaymentMethodT, VatPlaneT } from '@/lib/constants/transfers'
import type { PreviewFileT } from '@/types/media'

/**
 * A transfer row as rendered in the transfers table. Cross-cutting: produced by the
 * server query (`lib/queries/transfer-mapping.ts`) and consumed across the UI
 * (tables, forms, dialogs), the export pipeline, and actions — so it lives here
 * rather than in any single module.
 */
export type TransferRowT = {
  id: number
  description: string
  amount: number
  // What the investor is billed, when that differs from the brutto that left the kasa (the netto
  // expense type). null on every type that bills at `amount`.
  netAmount: number | null
  type: TransferTypeT
  // null on every type that never asks it — see `carriesPaymentMethod`.
  paymentMethod: PaymentMethodT | null
  date: string
  sourceRegisterId: number | null
  sourceRegisterName: string
  targetRegisterId: number | null
  targetRegisterName: string
  investmentId: number | null
  investmentName: string
  expenseCategoryId: number | null
  expenseCategoryName: string
  otherCategoryName: string
  otherCategoryId: number | null
  workerName: string
  workerId: number | null
  createdByName: string
  createdById: number | null
  createdAt: string
  // Every page of the invoice, in the order they were attached. Empty when nothing is attached.
  invoices: PreviewFileT[]
  invoiceNote: string | null
  cancelled: boolean
  settled: boolean
  // Netto/Brutto plane the amount is stated on; null when unspecified.
  vatPlane: VatPlaneT | null
  // For a CANCELLATION row: the type of the original transfer it reverses (display-only). null otherwise.
  originalType: TransferTypeT | null
}

// PAYOUT-per-worker total for one investment. `workerId` null is the „Bez przypisanego pracownika"
// bucket — why it exists at all is argued at the query that keeps it (`get-payout-transactions.ts`).
export type PayoutByWorkerT = {
  workerId: number | null
  total: number
}

// The subcontractor summary block's row: `derivePayoutsByWorker` resolves the name off the roster,
// so the query never joins workers and a rename can't bust its cache.
export type SubcontractorPayoutRowT = PayoutByWorkerT & {
  name: string
}

// One realized PAYOUT transaction, for the subcontractor block's sortable wypłaty list. Worker name
// resolves at render from the SubcontractorPayoutRowT set.
export type PayoutTransactionRowT = {
  workerId: number | null
  date: string
  amount: number
  description: string | null
}

// One INVESTOR_DEPOSIT transaction for the client Podsumowanie's wpłaty list — mirrors
// PayoutTransactionRowT. `vatPlane` is null for wpłaty booked before the plane became a required
// choice in the form — the reconciliation reads those as netto.
export type DepositTransactionRowT = {
  id: number
  date: string
  amount: number
  // The netto off the faktura, stored on a wpłata brutto only — its netto twin is a fact read from
  // the row, never derived at VAT (see `deposit-planes.ts`).
  netAmount: number | null
  vatPlane: VatPlaneT | null
}

// One materiały (Wydatki inwestycyjne) transaction for the Podsumowanie's wydatki list — an
// INVESTMENT_EXPENSE / INVESTMENT_EXPENSE_NET / CORRECTION row. Sourced from the existing
// `findTransfersRaw` fetch; the expense-category `label` is resolved in the shared fetcher, not at
// either page, so the owner view and the client share view label a row identically. `settled` and
// `type` together pick the row's tab — see `partitionExpenseRows`; the list shows exactly one of the
// three sets at a time. `invoices` feeds the list's bulk-ZIP download and its per-row
// preview, and is empty when no invoice is attached. `invoiceNote` is the transfer's free-text note —
// written by the AI scan in a known shape, but just as often typed by hand (see `lib/utils/invoice-note`).
export type MaterialTransactionRowT = {
  id: number
  date: string
  // Brutto — what left the kasa. `billed` is what the investor is charged for this row; the two
  // differ only on the netto type (see `sumBilled` for what the tab totals must reconcile with).
  amount: number
  billed: number
  label: string
  description: string | null
  settled: boolean
  // Optional because the client share read is `unstable_cache`d: a warm entry written before this
  // field existed serves rows without it until KOSZTORYS_TAGS invalidates. Every consumer has to
  // handle that, and `undefined` here is what stops a cleanup pass deleting the guards as dead.
  type: TransferTypeT | undefined
  invoices: PreviewFileT[]
  invoiceNote: string | null
}
