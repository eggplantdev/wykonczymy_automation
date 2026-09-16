import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { isServerSortableColumn } from '@/lib/transfers/sortable-columns'
import { OptionalLink } from '@/components/ui/optional-link'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
import { InvoiceCell } from '@/components/transfers/invoice-cell'
import { NotePopover } from '@/components/transfers/note-popover'
import { CancelTransferButton } from '@/components/transfers/cancel-transfer-button'
import { EditTransferDialog } from '@/components/dialogs/edit-transfer-dialog'
import { canMutateTransfer, type RoleT } from '@/lib/auth/roles'
import {
  TRANSFER_TYPE_COLORS,
  isCancellationType,
  EXPENSE_CATEGORY_LABEL,
  SETTLED_TYPE,
  billsNetAmount,
} from '@/lib/constants/transfers'
import { INVESTMENT_LOCKED_MESSAGE, isBookableInvestment } from '@/lib/constants/investment-lock'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import {
  transferAmountText,
  transferPaymentMethodText,
  transferTypeText,
  transferVatPlaneText,
} from '@/lib/transfers/transfer-text'
import type { TransferRowT } from '@/types/transfers'

const col = createColumnHelper<TransferRowT>()

const allColumns = [
  col.accessor('id', {
    id: 'id',
    header: 'ID',
    meta: { printValue: (row) => `#${row.id}` },
    cell: (info) => `#${info.getValue()}`,
  }),
  col.accessor('date', {
    id: 'date',
    header: 'Data',
    meta: { printValue: (row) => formatPLDate(row.date) },
    cell: (info) => formatPLDate(info.getValue()),
  }),
  col.accessor('amount', {
    id: 'amount',
    header: 'Kwota',
    meta: { printValue: transferAmountText },
    cell: (info) => {
      const { type, cancelled, settled, netAmount } = info.row.original
      const isMuted = cancelled || type === 'CANCELLATION'
      const color = settled ? SETTLED_TYPE.color : TRANSFER_TYPE_COLORS[type]
      // Brutto stays the primary figure: this column is summed against the kasa balance, and only
      // the amount that left the register reconciles there.
      const showsNet = billsNetAmount(type) && netAmount !== null
      return (
        <span
          className="flex flex-col font-medium"
          style={isMuted ? undefined : { color: `var(--color-${color})` }}
        >
          {formatPLN(info.getValue())}
          {showsNet && (
            <span className="text-muted-foreground text-xs">netto {formatPLN(netAmount)}</span>
          )}
        </span>
      )
    },
  }),
  col.accessor('vatPlane', {
    id: 'vatPlane',
    // The tag names the FORM the wpłata arrived in, not the plane the bill is settled in — same
    // dictionary as the deposit list in the panel. „netto"/„brutto" naming both on one screen is
    // what made the reader guess which of the two a given cell meant (owner, 2026-08-23).
    header: 'Forma wpłaty',
    meta: { printValue: transferVatPlaneText },
    cell: (info) => transferVatPlaneText(info.row.original),
  }),
  col.accessor('investmentName', {
    id: 'investment',
    header: 'Inwestycja',
    meta: { minWidth: 'min-w-40', printValue: (row) => row.investmentName },
    cell: (info) => {
      const id = info.row.original.investmentId
      const name = info.getValue()
      return (
        <OptionalLink href={name !== '—' && id ? `/inwestycje/${id}` : undefined}>
          {name}
        </OptionalLink>
      )
    },
  }),
  col.accessor('type', {
    id: 'type',
    header: 'Typ',
    meta: { minWidth: 'min-w-40', printValue: transferTypeText },
    cell: (info) => transferTypeText(info.row.original),
  }),
  col.accessor('expenseCategoryName', {
    id: 'expenseCategory',
    header: EXPENSE_CATEGORY_LABEL,
    meta: { printValue: (row) => row.expenseCategoryName },
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
    meta: { minWidth: 'min-w-64', printValue: (row) => row.description },
    cell: (info) => <span className="whitespace-pre-line">{info.getValue()}</span>,
  }),
  col.accessor('otherCategoryName', {
    id: 'otherCategory',
    header: 'Kategoria (inne wydatki)',
    meta: { printValue: (row) => row.otherCategoryName },
    cell: (info) => info.getValue(),
  }),

  col.accessor('invoices', {
    id: 'invoice',
    header: 'Faktura',
    meta: { align: 'center' },
    cell: (info) => <InvoiceCell transactionId={info.row.original.id} invoices={info.getValue()} />,
  }),
  col.accessor('invoiceNote', {
    id: 'invoiceNote',
    header: 'Notatka',
    meta: { align: 'center' },
    cell: (info) => <NotePopover note={info.getValue()} />,
  }),

  col.accessor('sourceRegisterName', {
    id: 'sourceRegister',
    header: 'Kasa źródłowa',
    meta: { minWidth: 'min-w-40', printValue: (row) => row.sourceRegisterName },
    cell: (info) => {
      const id = info.row.original.sourceRegisterId
      const name = info.getValue()
      return (
        <OptionalLink href={name !== '—' && id ? `/kasa/${id}` : undefined}>{name}</OptionalLink>
      )
    },
  }),
  col.accessor('targetRegisterName', {
    id: 'targetRegister',
    header: 'Kasa docelowa',
    meta: { printValue: (row) => row.targetRegisterName },
    cell: (info) => {
      const id = info.row.original.targetRegisterId
      const name = info.getValue()
      return (
        <OptionalLink href={name !== '—' && id ? `/kasa/${id}` : undefined}>{name}</OptionalLink>
      )
    },
  }),

  col.accessor('paymentMethod', {
    id: 'paymentMethod',
    header: 'Metoda',
    meta: { printValue: transferPaymentMethodText },
    cell: (info) => transferPaymentMethodText(info.row.original),
  }),
  col.accessor('workerName', {
    id: 'worker',
    header: 'Pracownik',
    meta: { printValue: (row) => row.workerName },
    cell: (info) => {
      const id = info.row.original.workerId
      const name = info.getValue()
      return (
        <OptionalLink href={name !== '—' && id ? `/pracownicy/${id}` : undefined}>
          {name}
        </OptionalLink>
      )
    },
  }),
  col.accessor('createdByName', {
    id: 'createdBy',
    header: 'Dodane przez',
    meta: { minWidth: 'min-w-40', printValue: (row) => row.createdByName },
    cell: (info) => info.getValue(),
  }),
  col.accessor('createdAt', {
    id: 'createdAt',
    header: 'Czas dodania',
    meta: { minWidth: 'min-w-40', printValue: (row) => formatPLDateTime(row.createdAt) },
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

  // Built once per column set, not per rendered row: the cell only knows its investment's id, so
  // without this every row would rescan the whole reference list on every sort and filter pass.
  const lockedInvestmentIds = new Set(
    referenceData?.investments.filter((i) => !isBookableInvestment(i)).map((i) => i.id) ?? [],
  )

  const actionsColumn = col.display({
    id: 'actions',
    header: 'Akcje',
    meta: { align: 'right' },
    cell: (info) => {
      const row = info.row.original
      if (row.cancelled || isCancellationType(row.type)) return null

      // Courtesy, not a gate — the collection hook refuses either write regardless. Read off
      // reference data because the row carries the investment's name and id, never its status.
      const lockedInvestment = row.investmentId != null && lockedInvestmentIds.has(row.investmentId)

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
        <div className="flex items-center justify-end gap-1">
          {referenceData && (
            <EditTransferDialog
              row={row}
              referenceData={referenceData}
              canEdit={canEdit && !lockedInvestment}
              disabledReason={lockedInvestment ? INVESTMENT_LOCKED_MESSAGE : undefined}
            />
          )}
          {!lockedInvestment && <CancelTransferButton transactionId={row.id} />}
        </div>
      )
    },
  })

  // Sortability is derived, never declared per column: a column showing a name from another table
  // (investment, kasy, kategorie, worker, createdBy) carries only the id in the row — the name is
  // joined in after the page is fetched, so the database has nothing to order by and the click
  // would silently sort one page. Those columns narrow by filter instead (EX-777). Deriving keeps
  // the whitelist the single source of truth; declaring it here needed a spec to stop the two drifting.
  const columns: ColumnDef<TransferRowT, unknown>[] = [...allColumns, actionsColumn].map(
    (column) =>
      isServerSortableColumn(column.id!)
        ? (column as ColumnDef<TransferRowT, unknown>)
        : { ...(column as ColumnDef<TransferRowT, unknown>), enableSorting: false },
  )

  if (exclude.length === 0) return columns
  const excludeSet = new Set(exclude)
  return columns.filter((c) => !excludeSet.has(c.id!))
}
