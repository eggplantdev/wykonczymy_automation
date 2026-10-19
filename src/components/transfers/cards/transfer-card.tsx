'use client'

import type { ReactNode } from 'react'
import { flexRender, type Row } from '@tanstack/react-table'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { billsNetAmount, transferTextClass } from '@/lib/constants/transfers'
import { EMPTY_RELATION_NAME } from '@/lib/utils/get-relation-name'
import { transferPaymentMethodText } from '@/lib/transfers/transfer-text'
import { TransferTypeBadge } from '@/components/transfers/transfer-type-badge'
import { CardChip } from '@/components/transfers/cards/card-chip'
import { RowActionLabels } from '@/components/ui/row-actions/row-action-labels'
import { useTranslation } from '@/hooks/use-translation'
import type { TransferRowT } from '@/types/transfers'

type PropsT = {
  row: Row<TransferRowT>
  uncoloredAmounts?: boolean
  className?: string
}

const isNamed = (name: string) => name !== EMPTY_RELATION_NAME

export function TransferCard({ row, uncoloredAmounts = false, className }: PropsT) {
  const cells = new Map(row.getAllCells().map((cell) => [cell.column.id, cell]))
  const hasColumn = (columnId: string) => cells.has(columnId)
  const renderCell = (columnId: string): ReactNode => {
    const cell = cells.get(columnId)
    return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null
  }
  const translator = useTranslation('transfers')
  const transfer = row.original
  const isMuted = transfer.cancelled || transfer.type === 'CANCELLATION'
  const showsNet = billsNetAmount(transfer.type)
  const { t } = translator
  const hasExpenseCategory = isNamed(transfer.expenseCategoryName)
  const categoryColumn = hasExpenseCategory ? 'expenseCategory' : 'otherCategory'
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

      <div className="flex items-center justify-between gap-1.5">
        <TransferTypeBadge transfer={transfer} translator={translator} />
        {hasColumn('payoutStatus') && transfer.payoutStatus && renderCell('payoutStatus')}
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-lg font-semibold',
            transfer.cancelled && 'line-through',
            !isMuted && !uncoloredAmounts && transferTextClass(transfer),
          )}
        >
          {formatPLN(transfer.amount)}
        </span>
        {showsNet && transfer.netAmount !== null && (
          <span className="text-muted-foreground text-xs">
            {translator.t('netAmount', { amount: formatPLN(transfer.netAmount) })}
          </span>
        )}
      </div>

      {hasColumn('investment') && isNamed(transfer.investmentName) && (
        <div className="text-muted-foreground truncate text-sm">{renderCell('investment')}</div>
      )}

      {hasColumn('description') && transfer.description && (
        <p className="line-clamp-3 text-sm whitespace-pre-line">{transfer.description}</p>
      )}

      <div className="flex flex-wrap gap-1">
        {hasColumn('sourceRegister') && isNamed(transfer.sourceRegisterName) && (
          <CardChip kind="register" label={t('colSourceRegister')}>
            {renderCell('sourceRegister')}
          </CardChip>
        )}
        {hasColumn('targetRegister') && isNamed(transfer.targetRegisterName) && (
          <CardChip kind="register" label={t('colTargetRegister')}>
            {renderCell('targetRegister')}
          </CardChip>
        )}
        {hasColumn('worker') && isNamed(transfer.workerName) && (
          <CardChip kind="worker" label={t('colWorker')}>
            {renderCell('worker')}
          </CardChip>
        )}
        {hasColumn(categoryColumn) && category && isNamed(category) && (
          <CardChip
            kind="category"
            label={t(hasExpenseCategory ? 'colExpenseCategory' : 'colOtherCategory')}
          >
            {category}
          </CardChip>
        )}
        {hasColumn('paymentMethod') && transfer.paymentMethod && (
          <CardChip kind="paymentMethod" label={t('colPaymentMethod')}>
            {transferPaymentMethodText(transfer, translator)}
          </CardChip>
        )}
        {hasColumn('createdBy') && transfer.createdByName && isNamed(transfer.createdByName) && (
          <CardChip kind="createdBy" label={t('colCreatedBy')}>
            {transfer.createdByName}
          </CardChip>
        )}
      </div>

      <RowActionLabels value>
        <footer className="flex flex-wrap items-center gap-1.5">
          {renderCell('invoice')}
          {renderCell('invoiceNote')}
          <div className="ml-auto">{renderCell('actions')}</div>
        </footer>
      </RowActionLabels>
    </article>
  )
}
