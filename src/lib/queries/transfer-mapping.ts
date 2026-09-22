import { getRelationName } from '@/lib/utils/get-relation-name'
import { resolveId } from '@/lib/utils/resolve-id'
import type { TransferTypeT, PaymentMethodT, VatPlaneT } from '@/lib/constants/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { MediaInfoT } from '@/lib/queries/media'
import { resolveInvoiceFiles } from '@/lib/invoices/invoice-field'
import type { UploadFieldT } from '@/lib/media/upload-field'
import type { TransferRowT } from '@/types/transfers'

type NameMapT = Map<number, string>

export type TransferLookupsT = {
  cashRegisters: NameMapT
  investments: NameMapT
  users: NameMapT
  expenseCategories: NameMapT
  otherCategories: NameMapT
  media: Map<number, MediaInfoT>
}

/**
 * Builds lookup Maps from reference data + media map for use with mapTransferRow.
 */
export function buildTransferLookups(
  refData: ReferenceDataBaseT,
  mediaMap: Map<number, MediaInfoT>,
): TransferLookupsT {
  const toNameMap = (items: { id: number; name: string }[]): NameMapT =>
    new Map(items.map((i) => [i.id, i.name]))

  return {
    cashRegisters: toNameMap(refData.cashRegisters),
    investments: toNameMap(refData.investments),
    users: toNameMap(refData.workers),
    expenseCategories: toNameMap(refData.expenseCategories),
    otherCategories: toNameMap(refData.otherCategories),
    media: mediaMap,
  }
}

// A depth:0 transfer doc: relationship fields are IDs, not populated objects.
// `originalType` is spliced in by TransferTableServer for CANCELLATION audit rows
// and isn't part of the collection schema.
type RelationIdT = number | null | undefined

export type TransferDocT = {
  id: number
  description?: string | null
  amount: number
  netAmount?: number | null
  type: string
  paymentMethod?: string | null
  date: string
  sourceRegister?: RelationIdT
  targetRegister?: RelationIdT
  investment?: RelationIdT
  expenseCategory?: RelationIdT
  otherCategory?: RelationIdT
  worker?: RelationIdT
  createdBy?: RelationIdT
  createdAt: string
  invoice?: UploadFieldT
  invoiceNote?: string | null
  cancelled?: boolean | null
  settled?: boolean | null
  vatPlane?: VatPlaneT | null
  originalType?: TransferTypeT | null
}

/** Maps a depth:0 transfer document to a flat TransferRowT, resolving IDs via lookup maps. */
export function mapTransferRow(doc: TransferDocT, lookups: TransferLookupsT): TransferRowT {
  return {
    id: doc.id,
    description: doc.description ?? '',
    amount: doc.amount,
    netAmount: doc.netAmount ?? null,
    type: doc.type as TransferTypeT,
    paymentMethod: (doc.paymentMethod as PaymentMethodT | null) ?? null,
    date: doc.date,
    sourceRegisterId: toNullableId(doc.sourceRegister),
    targetRegisterId: toNullableId(doc.targetRegister),
    investmentId: toNullableId(doc.investment),
    expenseCategoryId: toNullableId(doc.expenseCategory),
    otherCategoryId: toNullableId(doc.otherCategory),
    workerId: toNullableId(doc.worker),
    createdById: toNullableId(doc.createdBy),
    createdAt: doc.createdAt,
    invoiceNote: doc.invoiceNote ?? null,
    cancelled: doc.cancelled ?? false,
    settled: doc.settled ?? false,
    vatPlane: doc.vatPlane ?? null,
    originalType: doc.originalType ?? null,
    sourceRegisterName: lookupName(lookups.cashRegisters, doc.sourceRegister),
    targetRegisterName: lookupName(lookups.cashRegisters, doc.targetRegister),
    investmentName: lookupName(lookups.investments, doc.investment),
    expenseCategoryName: lookupName(lookups.expenseCategories, doc.expenseCategory),
    otherCategoryName: lookupName(lookups.otherCategories, doc.otherCategory),
    workerName: lookupName(lookups.users, doc.worker),
    createdByName: lookupName(lookups.users, doc.createdBy),
    invoices: resolveInvoiceFiles(doc.invoice, lookups.media),
  }
}

// `TransferRowT` spells "no relation" as null, `resolveId` as undefined.
function toNullableId(field: unknown): number | null {
  return resolveId(field) ?? null
}

function lookupName(map: NameMapT, field: unknown): string {
  if (typeof field === 'number') return map.get(field) ?? '—'
  return getRelationName(field)
}
