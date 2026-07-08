import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
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
  SETTLED_TYPE,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { TransferRowT } from '@/lib/queries/transfer-mapping'

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
      const { type, cancelled, settled } = info.row.original
      const isMuted = cancelled || type === 'CANCELLATION'
      const color = settled ? SETTLED_TYPE.color : TRANSFER_TYPE_COLORS[type]
      return (
        <span
          className="font-medium"
          style={isMuted ? undefined : { color: `var(--color-${color})` }}
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
    cell: (info) => {
      const { settled, type, originalType } = info.row.original
      if (settled) return SETTLED_TYPE.label
      const label = TRANSFER_TYPE_LABELS[type] ?? type
      // For a cancellation, append what it reversed: "Anulowanie (Wydatek inwestycyjny)"
      if (type === 'CANCELLATION' && originalType) {
        return `${label} (${TRANSFER_TYPE_LABELS[originalType] ?? originalType})`
      }
      return label
    },
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
    cell: (info) => <span className="whitespace-pre-line">{info.getValue()}</span>,
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
