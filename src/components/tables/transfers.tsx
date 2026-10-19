import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { transferSort } from '@/lib/transfers/sortable-columns'
import { OptionalLink } from '@/components/ui/optional-link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
import { InvoiceCell } from '@/components/transfers/invoice-cell'
import { NotePopover } from '@/components/transfers/note-popover'
import { CancelTransferButton } from '@/components/transfers/cancel-transfer-button'
import { TransferTypeBadge } from '@/components/transfers/transfer-type-badge'
import { PayoutStatusBadge } from '@/components/payouts/payout-status-badge'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { EditTransferDialog } from '@/components/dialogs/edit-transfer-dialog'
import {
  canCancelTransfer,
  canMutateTransfer,
  isManagementRole,
  type RoleT,
} from '@/lib/auth/roles'
import { isCancellationType, billsNetAmount, transferTextClass } from '@/lib/constants/transfers'
import { EMPTY_RELATION_NAME } from '@/lib/utils/get-relation-name'
import { POLISH_TRANSFERS, type TranslatorT } from '@/lib/i18n/translations'
import { INVESTMENT_LOCKED_MESSAGE, isBookableInvestment } from '@/lib/constants/investment-lock'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import {
  transferAmountText,
  transferPaymentMethodText,
  transferOrderStatusText,
  transferPayoutStatusText,
  transferTypeText,
  transferVatPlaneText,
} from '@/lib/transfers/transfer-text'
import type { TransferRowT } from '@/types/transfers'

const col = createColumnHelper<TransferRowT>()

// Their cells link into `/kasa/[id]` and `/inwestycje/[id]`, both management-only — a worker would
// follow the link into a 404.
const MANAGEMENT_LINK_COLUMNS = new Set(['sourceRegister', 'targetRegister', 'investment'])

const registerLink = (name: string, id: number | null, isTrashed: boolean) => (
  <OptionalLink href={name !== EMPTY_RELATION_NAME && id && !isTrashed ? `/kasa/${id}` : undefined}>
    {name}
  </OptionalLink>
)

const buildColumns = (
  translator: TranslatorT<'transfers'>,
  uncoloredAmounts: boolean,
  canFlipOrder: (row: TransferRowT) => boolean,
) => {
  const { t } = translator
  return [
    col.accessor('id', {
      id: 'id',
      header: t('colId'),
      meta: { printValue: (row) => `#${row.id}` },
      cell: (info) => `#${info.getValue()}`,
    }),
    col.accessor('date', {
      id: 'date',
      header: t('colDate'),
      meta: { printValue: (row) => formatPLDate(row.date) },
      cell: (info) => formatPLDate(info.getValue()),
    }),
    col.accessor('amount', {
      id: 'amount',
      header: t('colAmount'),
      meta: { printValue: (row) => transferAmountText(row, translator) },
      cell: (info) => {
        const { type, cancelled, netAmount } = info.row.original
        const isMuted = cancelled || type === 'CANCELLATION'
        // Brutto stays the primary figure: this column is summed against the kasa balance, and only
        // the amount that left the register reconciles there.
        const showsNet = billsNetAmount(type) && netAmount !== null
        return (
          <span
            className={cn(
              'flex flex-col font-medium',
              !isMuted && !uncoloredAmounts && transferTextClass(info.row.original),
            )}
          >
            {formatPLN(info.getValue())}
            {showsNet && (
              <span className="text-muted-foreground text-xs">
                {t('netAmount', { amount: formatPLN(netAmount) })}
              </span>
            )}
          </span>
        )
      },
    }),
    col.accessor('vatPlane', {
      id: 'vatPlane',
      header: t('colVatPlane'),
      meta: { printValue: (row) => transferVatPlaneText(row, translator) },
      cell: (info) => transferVatPlaneText(info.row.original, translator),
    }),
    col.accessor('investmentName', {
      id: 'investment',
      header: t('colInvestment'),
      meta: { minWidth: 'min-w-56', printValue: (row) => row.investmentName },
      cell: (info) => {
        const id = info.row.original.investmentId
        const name = info.getValue()
        return (
          <OptionalLink href={name !== EMPTY_RELATION_NAME && id ? `/inwestycje/${id}` : undefined}>
            {name}
          </OptionalLink>
        )
      },
    }),
    col.accessor('type', {
      id: 'type',
      header: t('colType'),
      meta: { minWidth: 'min-w-56', printValue: (row) => transferTypeText(row, translator) },
      cell: (info) => (
        <span className="flex flex-wrap items-center gap-1">
          <TransferTypeBadge transfer={info.row.original} translator={translator} />
          {info.row.original.fromWorkerDraft && <Badge tone="muted">{t('fromWorker')}</Badge>}
        </span>
      ),
    }),
    col.accessor('expenseCategoryName', {
      id: 'expenseCategory',
      header: t('colExpenseCategory'),
      meta: { printValue: (row) => row.expenseCategoryName },
      cell: (info) => info.getValue(),
    }),
    col.accessor('description', {
      id: 'description',
      header: t('colDescription'),
      meta: { minWidth: 'min-w-64', printValue: (row) => row.description },
      cell: (info) => <span className="whitespace-pre-line">{info.getValue()}</span>,
    }),
    col.accessor('otherCategoryName', {
      id: 'otherCategory',
      header: t('colOtherCategory'),
      meta: { printValue: (row) => row.otherCategoryName },
      cell: (info) => info.getValue(),
    }),

    col.accessor('invoices', {
      id: 'invoice',
      header: t('colInvoice'),
      meta: { align: 'center' },
      cell: (info) => (
        <InvoiceCell transactionId={info.row.original.id} invoices={info.getValue()} />
      ),
    }),
    col.accessor('invoiceNote', {
      id: 'invoiceNote',
      header: t('colInvoiceNote'),
      meta: { align: 'center' },
      cell: (info) => <NotePopover note={info.getValue()} />,
    }),

    col.accessor('sourceRegisterName', {
      id: 'sourceRegister',
      header: t('colSourceRegister'),
      meta: { minWidth: 'min-w-40', printValue: (row) => row.sourceRegisterName },
      cell: (info) => {
        const { sourceRegisterId, sourceRegisterTrashed } = info.row.original
        return registerLink(info.getValue(), sourceRegisterId, sourceRegisterTrashed)
      },
    }),
    col.accessor('targetRegisterName', {
      id: 'targetRegister',
      header: t('colTargetRegister'),
      meta: { printValue: (row) => row.targetRegisterName },
      cell: (info) => {
        const { targetRegisterId, targetRegisterTrashed } = info.row.original
        return registerLink(info.getValue(), targetRegisterId, targetRegisterTrashed)
      },
    }),

    col.accessor('paymentMethod', {
      id: 'paymentMethod',
      header: t('colPaymentMethod'),
      meta: { printValue: (row) => transferPaymentMethodText(row, translator) },
      cell: (info) => transferPaymentMethodText(info.row.original, translator),
    }),
    col.accessor('workerName', {
      id: 'worker',
      header: t('colWorker'),
      meta: { printValue: (row) => row.workerName },
      cell: (info) => {
        const id = info.row.original.workerId
        const name = info.getValue()
        return (
          <OptionalLink href={name !== EMPTY_RELATION_NAME && id ? `/pracownicy/${id}` : undefined}>
            {name}
          </OptionalLink>
        )
      },
    }),
    col.accessor('payoutStatus', {
      id: 'payoutStatus',
      header: t('colPayoutStatus'),
      meta: {
        minWidth: 'min-w-40',
        printValue: (row) => transferPayoutStatusText(row, translator),
      },
      cell: (info) => {
        const row = info.row.original
        return row.payoutStatus ? (
          <PayoutStatusBadge
            status={row.payoutStatus}
            cancelled={row.cancelled}
            translator={translator}
          />
        ) : (
          transferPayoutStatusText(row, translator)
        )
      },
    }),
    col.accessor('payoutDecidedAt', {
      id: 'payoutDecidedAt',
      header: t('colPayoutDecidedAt'),
      meta: {
        minWidth: 'min-w-40',
        printValue: (row) => (row.payoutDecidedAt ? formatPLDateTime(row.payoutDecidedAt) : ''),
      },
      cell: (info) => {
        const decidedAt = info.getValue()
        return decidedAt ? formatPLDateTime(decidedAt) : ''
      },
    }),
    col.accessor('payoutRejectionReason', {
      id: 'payoutRejectionReason',
      header: t('colPayoutRejectionReason'),
      meta: { minWidth: 'min-w-56', printValue: (row) => row.payoutRejectionReason ?? '' },
      cell: (info) => <span className="whitespace-pre-line">{info.getValue()}</span>,
    }),
    col.accessor('orderStatus', {
      id: 'orderStatus',
      header: t('colOrderStatus'),
      meta: { printValue: (row) => transferOrderStatusText(row, translator) },
      cell: (info) => {
        const row = info.row.original
        return (
          row.orderStatus && (
            <OrderStatusBadge
              transferId={row.id}
              status={row.orderStatus}
              cancelled={row.cancelled}
              canFlip={canFlipOrder(row)}
              translator={translator}
            />
          )
        )
      },
    }),
    col.accessor('createdByName', {
      id: 'createdBy',
      header: t('colCreatedBy'),
      meta: { minWidth: 'min-w-40', printValue: (row) => row.createdByName },
      cell: (info) => info.getValue(),
    }),
    col.accessor('createdAt', {
      id: 'createdAt',
      header: t('colCreatedAt'),
      meta: { minWidth: 'min-w-40', printValue: (row) => formatPLDateTime(row.createdAt) },
      cell: (info) => formatPLDateTime(info.getValue()),
    }),
  ]
}

type ColumnOptionsT = {
  referenceData?: ReferenceDataBaseT
  currentUserId?: number
  currentUserRole?: RoleT
  translator?: TranslatorT<'transfers'>
  uncoloredAmounts?: boolean
}

export function transferRowClassName(row: TransferRowT) {
  if (row.cancelled) return '[&_td]:line-through [&_td]:text-muted-foreground'
  if (row.type === 'CANCELLATION') return '[&_td]:text-muted-foreground'
  return ''
}

export function getTransferColumns(exclude: string[] = [], options: ColumnOptionsT = {}) {
  const {
    referenceData,
    currentUserId,
    currentUserRole,
    translator = POLISH_TRANSFERS,
    uncoloredAmounts = false,
  } = options

  const lockedInvestmentIds = new Set(
    referenceData?.investments.filter((i) => !isBookableInvestment(i)).map((i) => i.id) ?? [],
  )
  const isOnLockedInvestment = (row: TransferRowT) =>
    row.investmentId != null && lockedInvestmentIds.has(row.investmentId)
  const canFlipOrder = (row: TransferRowT) =>
    currentUserRole !== undefined && isManagementRole(currentUserRole) && !isOnLockedInvestment(row)

  const actionsColumn = col.display({
    id: 'actions',
    header: translator.t('colActions'),
    meta: { align: 'right' },
    cell: (info) => {
      const row = info.row.original
      if (row.cancelled || isCancellationType(row.type)) return null

      // Courtesy, not a gate — the collection hook refuses either write regardless.
      const lockedInvestment = isOnLockedInvestment(row)

      const actor =
        currentUserRole && currentUserId !== undefined
          ? {
              role: currentUserRole,
              userId: currentUserId,
              transferType: row.type,
              createdById: row.createdById,
            }
          : undefined
      const canEdit = actor !== undefined && canMutateTransfer(actor)
      const canCancel =
        actor !== undefined && canCancelTransfer({ ...actor, payoutStatus: row.payoutStatus })

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
          {!lockedInvestment && canCancel && <CancelTransferButton transactionId={row.id} />}
        </div>
      )
    },
  })

  // Sortability is derived, never declared per column: a column showing a name from another table
  // carries only the id in the row, and the name is joined in after the page is fetched — so the
  // database has nothing to order by and the click would silently sort one page.
  const columns: ColumnDef<TransferRowT, unknown>[] = [
    ...buildColumns(translator, uncoloredAmounts, canFlipOrder),
    actionsColumn,
  ]
    .map((column) =>
      transferSort.isSortable(column.id!)
        ? (column as ColumnDef<TransferRowT, unknown>)
        : { ...(column as ColumnDef<TransferRowT, unknown>), enableSorting: false },
    )
    .map((column) =>
      currentUserRole &&
      !isManagementRole(currentUserRole) &&
      MANAGEMENT_LINK_COLUMNS.has(column.id!)
        ? { ...column, cell: (info) => info.getValue() as string }
        : column,
    )

  if (exclude.length === 0) return columns
  const excludeSet = new Set(exclude)
  return columns.filter((c) => !excludeSet.has(c.id!))
}
