import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/format-date'
import { getRelationName } from '@/lib/get-relation-name'
import { InvoiceCell } from '@/components/transfers/invoice-cell'
import { NoteCell } from '@/components/dialogs/note-dialog'
import { CancelTransferButton } from '@/components/transfers/cancel-transfer-button'
import { EditTransferDialog } from '@/components/dialogs/edit-transfer-dialog'
import { canMutateTransfer, type RoleT } from '@/lib/auth/roles'
import {
  TRANSFER_TYPE_LABELS,
  TRANSFER_TYPE_COLORS,
  PAYMENT_METHOD_LABELS,
  isCancellationType,
  EXPENSE_CATEGORY_LABEL,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
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

/**
 * Maps a Payload transfer document to a flat TransferRowT.
 * When `lookups` is provided, resolves IDs from maps (depth: 0 mode).
 * When omitted, falls back to populated objects (depth: 1 mode).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapTransferRow(doc: any, lookups?: TransferLookupsT): TransferRowT {
  if (lookups) {
    const mediaId = typeof doc.invoice === 'number' ? doc.invoice : null
    const media = mediaId ? lookups.media.get(mediaId) : undefined

    return {
      id: doc.id,
      description: doc.description,
      amount: doc.amount,
      type: doc.type as TransferTypeT,
      paymentMethod: doc.paymentMethod as PaymentMethodT,
      date: doc.date,
      sourceRegisterId: toNullableId(doc.sourceRegister),
      sourceRegisterName: lookupName(lookups.cashRegisters, doc.sourceRegister),
      targetRegisterId: toNullableId(doc.targetRegister),
      targetRegisterName: lookupName(lookups.cashRegisters, doc.targetRegister),
      investmentId: toNullableId(doc.investment),
      investmentName: lookupName(lookups.investments, doc.investment),
      expenseCategoryId: toNullableId(doc.expenseCategory),
      expenseCategoryName: lookupName(lookups.expenseCategories, doc.expenseCategory),
      otherCategoryName: lookupName(lookups.otherCategories, doc.otherCategory),
      otherCategoryId: toNullableId(doc.otherCategory),
      workerName: lookupName(lookups.users, doc.worker),
      workerId: toNullableId(doc.worker),
      createdByName: lookupName(lookups.users, doc.createdBy),
      createdById: toNullableId(doc.createdBy),
      createdAt: doc.createdAt,
      invoiceUrl: media?.url ?? null,
      invoiceFilename: media?.filename ?? null,
      invoiceMimeType: media?.mimeType ?? null,
      invoiceNote: doc.invoiceNote ?? null,
      cancelled: doc.cancelled ?? false,
    }
  }

  return {
    id: doc.id,
    description: doc.description,
    amount: doc.amount,
    type: doc.type as TransferTypeT,
    paymentMethod: doc.paymentMethod as PaymentMethodT,
    date: doc.date,
    sourceRegisterId: toNullableId(doc.sourceRegister),
    sourceRegisterName: getRelationName(doc.sourceRegister),
    targetRegisterId: toNullableId(doc.targetRegister),
    targetRegisterName: getRelationName(doc.targetRegister),
    investmentId: toNullableId(doc.investment),
    investmentName: getRelationName(doc.investment),
    expenseCategoryId: toNullableId(doc.expenseCategory),
    expenseCategoryName: getRelationName(doc.expenseCategory),
    otherCategoryName: getRelationName(doc.otherCategory),
    otherCategoryId: toNullableId(doc.otherCategory),
    workerName: getRelationName(doc.worker),
    workerId: toNullableId(doc.worker),
    createdByName: getRelationName(doc.createdBy),
    createdById: toNullableId(doc.createdBy),
    createdAt: doc.createdAt,
    invoiceUrl: getMediaField(doc.invoice, 'url'),
    invoiceFilename: getMediaField(doc.invoice, 'filename'),
    invoiceMimeType: getMediaField(doc.invoice, 'mimeType'),
    invoiceNote: doc.invoiceNote ?? null,
    cancelled: doc.cancelled ?? false,
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

function getMediaField(field: unknown, key: string): string | null {
  if (typeof field === 'object' && field !== null && key in field) {
    return (field as Record<string, unknown>)[key] as string | null
  }
  return null
}

const col = createColumnHelper<TransferRowT>()

const allColumns = [
  col.accessor('id', {
    id: 'id',
    header: 'ID',
    cell: (info) => `#${info.getValue()}`,
  }),
  col.accessor('date', {
    id: 'date',
    header: 'Data',
    cell: (info) => formatPLDate(info.getValue()),
  }),
  col.accessor('amount', {
    id: 'amount',
    header: 'Kwota',
    cell: (info) => {
      const { type, cancelled } = info.row.original
      const isMuted = cancelled || type === 'CANCELLATION'
      return (
        <span
          className="font-medium"
          style={isMuted ? undefined : { color: `var(--color-${TRANSFER_TYPE_COLORS[type]})` }}
        >
          {formatPLN(info.getValue())}
        </span>
      )
    },
  }),
  col.accessor('investmentName', {
    id: 'investment',
    header: 'Inwestycja',
    cell: (info) => {
      const id = info.row.original.investmentId
      const name = info.getValue()
      if (!id || name === '—') return name
      return (
        <Link href={`/inwestycje/${id}`} className="hover:underline">
          {name}
        </Link>
      )
    },
  }),
  col.accessor('type', {
    id: 'type',
    header: 'Typ',
    cell: (info) => TRANSFER_TYPE_LABELS[info.getValue() as TransferTypeT] ?? info.getValue(),
  }),
  col.accessor('expenseCategoryName', {
    id: 'expenseCategory',
    header: EXPENSE_CATEGORY_LABEL,
    cell: (info) => info.getValue(),
  }),
  // TODO: add click-to-expand for long descriptions.
  // Tried a `<DescriptionCell>` client component with `useState` + `line-clamp-3`
  // toggle on a `<button>` inside this cell. Click handler appeared not to update
  // the rendered output (button "rendered once and not responding"). Root cause
  // unclear — suspects: React Compiler memoization of the cell render, TanStack
  // Table re-creating the cell node per parent render, or a Tailwind `display`
  // conflict between `block` and `line-clamp-3`. Revisit when overflow becomes
  // a real problem.
  col.accessor('description', {
    id: 'description',
    header: 'Opis',
    cell: (info) => {
      const row = info.row.original
      const value = info.getValue()
      if (row.type === 'CANCELLATION') {
        const colonIdx = value.indexOf(': ')
        if (colonIdx !== -1) {
          const prefix = value.slice(0, colonIdx + 1)
          const reason = value.slice(colonIdx + 2)
          return (
            <div className="flex flex-col gap-0.5 leading-tight">
              <span className="text-muted-foreground text-xs">{prefix}</span>
              <span className="font-medium">{reason}</span>
            </div>
          )
        }
      }
      return value
    },
  }),
  col.accessor('otherCategoryName', {
    id: 'otherCategory',
    header: 'Kategoria (inne wydatki)',
    cell: (info) => info.getValue(),
  }),

  col.accessor('invoiceUrl', {
    id: 'invoice',
    header: 'Faktura',
    enableSorting: false,
    cell: (info) => {
      const row = info.row.original
      return (
        <InvoiceCell
          transactionId={row.id}
          url={row.invoiceUrl}
          filename={row.invoiceFilename}
          mimeType={row.invoiceMimeType}
        />
      )
    },
  }),
  col.accessor('invoiceNote', {
    id: 'invoiceNote',
    header: 'Notatka',
    enableSorting: false,
    cell: (info) => <NoteCell note={info.getValue()} />,
  }),

  col.accessor('sourceRegisterName', {
    id: 'sourceRegister',
    header: 'Kasa źródłowa',
    cell: (info) => {
      const id = info.row.original.sourceRegisterId
      const name = info.getValue()
      if (!id || name === '—') return name
      return (
        <Link href={`/kasa/${id}`} className="hover:underline">
          {name}
        </Link>
      )
    },
  }),
  col.accessor('targetRegisterName', {
    id: 'targetRegister',
    header: 'Kasa docelowa',
    cell: (info) => {
      const id = info.row.original.targetRegisterId
      const name = info.getValue()
      if (!id || name === '—') return name
      return (
        <Link href={`/kasa/${id}`} className="hover:underline">
          {name}
        </Link>
      )
    },
  }),

  col.accessor('paymentMethod', {
    id: 'paymentMethod',
    header: 'Metoda',
    cell: (info) => PAYMENT_METHOD_LABELS[info.getValue() as PaymentMethodT] ?? info.getValue(),
  }),
  col.accessor('workerName', {
    id: 'worker',
    header: 'Pracownik',
    cell: (info) => {
      const id = info.row.original.workerId
      const name = info.getValue()
      if (!id || name === '—') return name
      return (
        <Link href={`/pracownicy/${id}`} className="hover:underline">
          {name}
        </Link>
      )
    },
  }),
  col.accessor('createdByName', {
    id: 'createdBy',
    header: 'Dodane przez',
    cell: (info) => info.getValue(),
  }),
  col.accessor('createdAt', {
    id: 'createdAt',
    header: 'Czas dodania',
    cell: (info) => formatPLDateTime(info.getValue()),
  }),
]

export type TransferColumnIdT = (typeof allColumns)[number]['id']

type ColumnOptionsT = {
  referenceData?: ReferenceDataBaseT
  currentUserId?: number
  currentUserRole?: RoleT
}

/**
 * Returns transfer column definitions, excluding specified column IDs.
 */
export function getTransferColumns(exclude: string[] = [], options: ColumnOptionsT = {}) {
  const { referenceData, currentUserId, currentUserRole } = options

  const actionsColumn = col.display({
    id: 'actions',
    header: 'Akcje',
    enableSorting: false,
    cell: (info) => {
      const row = info.row.original
      if (row.cancelled || isCancellationType(row.type)) return null

      const canEdit =
        !!currentUserRole &&
        currentUserId !== undefined &&
        canMutateTransfer({
          role: currentUserRole,
          userId: currentUserId,
          transferType: row.type,
          createdById: row.createdById,
        })

      return (
        <div className="flex items-center gap-1">
          {referenceData && (
            <EditTransferDialog row={row} referenceData={referenceData} canEdit={canEdit} />
          )}
          <CancelTransferButton transactionId={row.id} />
        </div>
      )
    },
  })

  const columns = [...allColumns, actionsColumn]

  if (exclude.length === 0) return columns
  const excludeSet = new Set(exclude)
  return columns.filter((c) => !excludeSet.has(c.id!))
}
