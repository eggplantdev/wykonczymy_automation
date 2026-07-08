import { getRelationName } from '@/lib/utils/get-relation-name'
import type { TransferTypeT, PaymentMethodT } from '@/lib/constants/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { MediaInfoT } from '@/lib/queries/media'

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
  // For a CANCELLATION row: the type of the original transfer it reverses (display-only). null otherwise.
  originalType: TransferTypeT | null
}

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
  type: string
  paymentMethod: string
  date: string
  sourceRegister?: RelationIdT
  targetRegister?: RelationIdT
  investment?: RelationIdT
  expenseCategory?: RelationIdT
  otherCategory?: RelationIdT
  worker?: RelationIdT
  createdBy?: RelationIdT
  createdAt: string
  invoice?: RelationIdT
  invoiceNote?: string | null
  cancelled?: boolean | null
  settled?: boolean | null
  originalType?: TransferTypeT | null
}

/** Maps a depth:0 transfer document to a flat TransferRowT, resolving IDs via lookup maps. */
export function mapTransferRow(doc: TransferDocT, lookups: TransferLookupsT): TransferRowT {
  const mediaId = typeof doc.invoice === 'number' ? doc.invoice : null
  const media = mediaId ? lookups.media.get(mediaId) : undefined

  return {
    id: doc.id,
    description: doc.description ?? '',
    amount: doc.amount,
    type: doc.type as TransferTypeT,
    paymentMethod: doc.paymentMethod as PaymentMethodT,
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
    originalType: doc.originalType ?? null,
    sourceRegisterName: lookupName(lookups.cashRegisters, doc.sourceRegister),
    targetRegisterName: lookupName(lookups.cashRegisters, doc.targetRegister),
    investmentName: lookupName(lookups.investments, doc.investment),
    expenseCategoryName: lookupName(lookups.expenseCategories, doc.expenseCategory),
    otherCategoryName: lookupName(lookups.otherCategories, doc.otherCategory),
    workerName: lookupName(lookups.users, doc.worker),
    createdByName: lookupName(lookups.users, doc.createdBy),
    invoiceUrl: media?.url ?? null,
    invoiceFilename: media?.filename ?? null,
    invoiceMimeType: media?.mimeType ?? null,
  }
}

/**
 * Extracts unique invoice IDs from raw (depth: 0) transfer docs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractInvoiceIds(docs: any[]): number[] {
  const ids = new Set<number>()
  for (const doc of docs) {
    if (typeof doc.invoice === 'number') ids.add(doc.invoice)
  }
  return [...ids]
}

function toNullableId(field: unknown): number | null {
  if (typeof field === 'number') return field
  if (typeof field === 'object' && field !== null && 'id' in field) {
    return (field as { id: number }).id
  }
  return null
}

function lookupName(map: NameMapT, field: unknown): string {
  if (typeof field === 'number') return map.get(field) ?? '—'
  return getRelationName(field)
}
