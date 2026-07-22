import type { TransferTypeT, PaymentMethodT, VatPlaneT } from '@/lib/constants/transfers'

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
  type: TransferTypeT
  paymentMethod: PaymentMethodT
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
  invoiceUrl: string | null
  invoiceFilename: string | null
  invoiceMimeType: string | null
  invoiceNote: string | null
  cancelled: boolean
  settled: boolean
  // Netto/Brutto plane the amount is stated on; null when unspecified.
  vatPlane: VatPlaneT | null
  // For a CANCELLATION row: the type of the original transfer it reverses (display-only). null otherwise.
  originalType: TransferTypeT | null
}
