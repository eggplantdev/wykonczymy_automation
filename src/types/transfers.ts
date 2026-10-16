import type { TransferTypeT, PaymentMethodT, VatPlaneT } from '@/lib/constants/transfers'
import type { PayoutStatusT } from '@/lib/constants/payout-confirmation'
import type { PreviewFileT } from '@/types/media'

export type TransferRowT = {
  id: number
  description: string
  amount: number
  netAmount: number | null
  type: TransferTypeT
  paymentMethod: PaymentMethodT | null
  date: string
  sourceRegisterId: number | null
  sourceRegisterName: string
  targetRegisterId: number | null
  targetRegisterName: string
  // A trashed kasa keeps its name here but has no page to link to.
  sourceRegisterTrashed: boolean
  targetRegisterTrashed: boolean
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
  invoices: PreviewFileT[]
  invoiceNote: string | null
  documentNumber: string | null
  sellerNip: string | null
  documentDate: string | null
  cancelled: boolean
  settled: boolean
  vatPlane: VatPlaneT | null
  originalType: TransferTypeT | null
  // null on every other type and on a wypłata booked before EX-1042, which no worker was ever asked
  // about.
  payoutStatus: PayoutStatusT | null
  payoutDecidedAt: string | null
  payoutRejectionReason: string | null
  fromWorkerDraft?: boolean
}

// `workerId` null is the „Bez przypisanego pracownika" bucket
export type PayoutByWorkerT = {
  workerId: number | null
  total: number
  /** Σ BONUS — kept out of `total`, which is cash paid; a premia is owed, not paid. */
  bonus: number
}

// `derivePayoutsByWorker` resolves the name off the roster, so the query never joins workers and a
// rename can't bust its cache.
export type SubcontractorPayoutRowT = PayoutByWorkerT & {
  name: string
}

export type PayoutTransactionRowT = {
  type: 'PAYOUT' | 'BONUS'
  workerId: number | null
  date: string
  amount: number
  description: string | null
}

// `vatPlane` is null for wpłaty booked before the plane became a required choice in the form — the
// reconciliation reads those as netto.
export type DepositTransactionRowT = {
  id: number
  date: string
  amount: number
  netAmount: number | null
  vatPlane: VatPlaneT | null
}

export type MaterialTransactionRowT = {
  id: number
  date: string
  amount: number
  billed: number
  label: string
  description: string | null
  settled: boolean
  type: TransferTypeT
  invoices: PreviewFileT[]
  invoiceNote: string | null
}
