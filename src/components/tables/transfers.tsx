import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { isServerSortableColumn } from '@/lib/transfers/sortable-columns'
import { OptionalLink } from '@/components/ui/optional-link'
import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
import { InvoiceCell } from '@/components/transfers/invoice-cell'
import { NotePopover } from '@/components/transfers/note-popover'
import { CancelTransferButton } from '@/components/transfers/cancel-transfer-button'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { RestoreExpenseDraftButton } from '@/components/worker-expenses/restore-expense-draft-button'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import { EditTransferDialog } from '@/components/dialogs/edit-transfer-dialog'
import { canMutateTransfer, isManagementRole, type RoleT } from '@/lib/auth/roles'
import {
  TRANSFER_TYPE_COLORS,
  isCancellationType,
  SETTLED_TYPE,
  billsNetAmount,
} from '@/lib/constants/transfers'
import { POLISH_TRANSFERS, type TranslatorT } from '@/lib/i18n/translations'
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

// Their cells link into `/kasa/[id]` and `/inwestycje/[id]`, both management-only — a worker would
// follow the link into a 404.
const MANAGEMENT_LINK_COLUMNS = new Set(['sourceRegister', 'targetRegister', 'investment'])

const buildColumns = (translator: TranslatorT<'transfers'>) => {
  const { t } = translator
  return [
    col.accessor('id', {
      id: 'id',
      header: t('colId'),
      meta: { printValue: (row) => `#${row.id}` },
      cell: (info) => (info.row.original.rejectedDraftId ? '—' : `#${info.getValue()}`),
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
        const { type, cancelled, settled, netAmount, rejectedDraftId } = info.row.original
        if (rejectedDraftId) return '—'
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
      // The tag names the FORM the wpłata arrived in, not the plane the bill is settled in — same
      // dictionary as the deposit list in the panel, because „netto"/„brutto" for both on one screen
      // left the reader guessing which a cell meant (owner, 2026-08-23).
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
          <OptionalLink href={name !== '—' && id ? `/inwestycje/${id}` : undefined}>
            {name}
          </OptionalLink>
        )
      },
    }),
    col.accessor('type', {
      id: 'type',
      header: t('colType'),
      meta: { minWidth: 'min-w-40', printValue: (row) => transferTypeText(row, translator) },
      cell: (info) => (
        <span className="flex flex-wrap items-center gap-1">
          {transferTypeText(info.row.original, translator)}
          {info.row.original.fromWorkerDraft && (
            <span className={cn(BADGE_BASE, BADGE_TONE.muted)}>{t('fromWorker')}</span>
          )}
          {info.row.original.rejectedDraftId && (
            <span className={cn(BADGE_BASE, BADGE_TONE.muted)}>{t('rejectedDraft')}</span>
          )}
        </span>
      ),
    }),
    col.accessor('expenseCategoryName', {
      id: 'expenseCategory',
      header: t('colExpenseCategory'),
      meta: { printValue: (row) => row.expenseCategoryName },
      cell: (info) => info.getValue(),
    }),
    // TODO: click-to-expand for long descriptions. A `<DescriptionCell>` with `useState` +
    // `line-clamp-3` rendered once and never responded to clicks; cause unclear (React Compiler,
    // TanStack re-creating the cell node, or `block` vs `line-clamp-3`). Revisit if overflow bites.
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
      cell: (info) =>
        info.row.original.rejectedDraftId ? (
          <MediaPreviewButton
            labels={INVOICE_PREVIEW_LABELS}
            files={info.getValue()}
            variant="compact"
          />
        ) : (
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
        const { sourceRegisterId: id, sourceRegisterTrashed: isTrashed } = info.row.original
        const name = info.getValue()
        return (
          <OptionalLink href={name !== '—' && id && !isTrashed ? `/kasa/${id}` : undefined}>
            {name}
          </OptionalLink>
        )
      },
    }),
    col.accessor('targetRegisterName', {
      id: 'targetRegister',
      header: t('colTargetRegister'),
      meta: { printValue: (row) => row.targetRegisterName },
      cell: (info) => {
        const { targetRegisterId: id, targetRegisterTrashed: isTrashed } = info.row.original
        const name = info.getValue()
        return (
          <OptionalLink href={name !== '—' && id && !isTrashed ? `/kasa/${id}` : undefined}>
            {name}
          </OptionalLink>
        )
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
          <OptionalLink href={name !== '—' && id ? `/pracownicy/${id}` : undefined}>
            {name}
          </OptionalLink>
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
}

export function getTransferColumns(exclude: string[] = [], options: ColumnOptionsT = {}) {
  const { referenceData, currentUserId, currentUserRole, translator = POLISH_TRANSFERS } = options

  // Built once per column set, not per rendered row: the cell only knows its investment's id, so
  // without this every row would rescan the whole reference list on every sort and filter pass.
  const lockedInvestmentIds = new Set(
    referenceData?.investments.filter((i) => !isBookableInvestment(i)).map((i) => i.id) ?? [],
  )

  const actionsColumn = col.display({
    id: 'actions',
    header: translator.t('colActions'),
    meta: { align: 'right' },
    cell: (info) => {
      const row = info.row.original
      if (row.rejectedDraftId) {
        return (
          <div className="flex justify-end">
            <RestoreExpenseDraftButton draftId={row.rejectedDraftId} />
          </div>
        )
      }
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
  // carries only the id in the row, and the name is joined in after the page is fetched — so the
  // database has nothing to order by and the click would silently sort one page. Those columns narrow
  // by filter instead (EX-777); deriving keeps the whitelist the single source of truth.
  const columns: ColumnDef<TransferRowT, unknown>[] = [...buildColumns(translator), actionsColumn]
    .map((column) =>
      isServerSortableColumn(column.id!)
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
