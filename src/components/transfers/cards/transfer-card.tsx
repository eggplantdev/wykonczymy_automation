'use client'

import type { ReactNode } from 'react'
import { flexRender, type Row } from '@tanstack/react-table'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { billsNetAmount, transferDisplayColor } from '@/lib/constants/transfers'
import { transferPaymentMethodText } from '@/lib/transfers/transfer-text'
import { TransferTypeBadge } from '@/components/transfers/transfer-type-badge'
import { RowActionLabels } from '@/components/ui/row-actions/row-action-labels'
import { useTranslation } from '@/hooks/use-translation'
import type { TransferRowT } from '@/types/transfers'

type PropsT = {
  row: Row<TransferRowT>
  className?: string
}

const EMPTY_NAME = '—'

// Cells come from the table's own column defs, so links, invoice upload and edit/cancel behave exactly
// as in the table, and a column the page excludes is absent here too.
function renderCell(row: Row<TransferRowT>, columnId: string): ReactNode {
  const cell = row.getAllCells().find((candidate) => candidate.column.id === columnId)
  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null
}

function hasColumn(row: Row<TransferRowT>, columnId: string) {
  return row.getAllCells().some((cell) => cell.column.id === columnId)
}

// One border colour per kind of fact, as on the Bayalab buildlog cards. The label inside carries the
// meaning — a bare name could be the worker, the kasa's owner or whoever booked it.
const CHIP_BORDER = {
  register: 'border-chart-blue',
  worker: 'border-chart-yellow',
  category: 'border-chart-purple',
  paymentMethod: 'border-chart-teal',
  createdBy: 'border-border',
} as const

type ChipKindT = keyof typeof CHIP_BORDER

function Chip({ kind, label, children }: { kind: ChipKindT; label: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
        CHIP_BORDER[kind],
      )}
    >
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="truncate">{children}</span>
    </span>
  )
}

export function TransferCard({ row, className }: PropsT) {
  const translator = useTranslation('transfers')
  const transfer = row.original
  const isMuted = transfer.cancelled || transfer.type === 'CANCELLATION'
  const showsNet = billsNetAmount(transfer.type) && transfer.netAmount !== null
  const hasSource = hasColumn(row, 'sourceRegister') && transfer.sourceRegisterName !== EMPTY_NAME
  const hasTarget = hasColumn(row, 'targetRegister') && transfer.targetRegisterName !== EMPTY_NAME
  const { t } = translator
  const paymentMethod = transferPaymentMethodText(transfer, translator)
  const hasExpenseCategory = transfer.expenseCategoryName !== EMPTY_NAME
  const category = hasExpenseCategory ? transfer.expenseCategoryName : transfer.otherCategoryName

  return (
    <article
      className={cn(
        'flex flex-col gap-2 px-4 py-3',
        isMuted && 'text-muted-foreground',
        transfer.cancelled && 'opacity-70',
        className,
      )}
    >
      <header className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">#{transfer.id}</span>
        <span className="text-muted-foreground ml-auto">{formatPLDate(transfer.date)}</span>
      </header>

      <TransferTypeBadge transfer={transfer} translator={translator} className="self-start" />

      <div className="flex items-baseline gap-2">
        <span
          className={cn('text-lg font-semibold', transfer.cancelled && 'line-through')}
          style={isMuted ? undefined : { color: `var(--color-${transferDisplayColor(transfer)})` }}
        >
          {formatPLN(transfer.amount)}
        </span>
        {showsNet && transfer.netAmount !== null && (
          <span className="text-muted-foreground text-xs">
            {translator.t('netAmount', { amount: formatPLN(transfer.netAmount) })}
          </span>
        )}
      </div>

      {hasColumn(row, 'investment') && transfer.investmentName !== EMPTY_NAME && (
        <div className="text-muted-foreground truncate text-sm">
          {renderCell(row, 'investment')}
        </div>
      )}

      {transfer.description && (
        <p className="line-clamp-3 text-sm whitespace-pre-line">{transfer.description}</p>
      )}

      <div className="flex flex-wrap gap-1">
        {hasSource && (
          <Chip kind="register" label={t('colSourceRegister')}>
            {renderCell(row, 'sourceRegister')}
          </Chip>
        )}
        {hasTarget && (
          <Chip kind="register" label={t('colTargetRegister')}>
            {renderCell(row, 'targetRegister')}
          </Chip>
        )}
        {hasColumn(row, 'worker') && transfer.workerName !== EMPTY_NAME && (
          <Chip kind="worker" label={t('colWorker')}>
            {renderCell(row, 'worker')}
          </Chip>
        )}
        {category && category !== EMPTY_NAME && (
          <Chip
            kind="category"
            label={t(hasExpenseCategory ? 'colExpenseCategory' : 'colOtherCategory')}
          >
            {category}
          </Chip>
        )}
        {paymentMethod && paymentMethod !== EMPTY_NAME && (
          <Chip kind="paymentMethod" label={t('colPaymentMethod')}>
            {paymentMethod}
          </Chip>
        )}
        {transfer.createdByName && transfer.createdByName !== EMPTY_NAME && (
          <Chip kind="createdBy" label={t('colCreatedBy')}>
            {transfer.createdByName}
          </Chip>
        )}
      </div>

      <RowActionLabels value>
        <footer className="flex flex-wrap items-center gap-1.5">
          {renderCell(row, 'invoice')}
          {renderCell(row, 'invoiceNote')}
          <div className="ml-auto">{renderCell(row, 'actions')}</div>
        </footer>
      </RowActionLabels>
    </article>
  )
}
