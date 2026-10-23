'use client'

import type { Row } from '@tanstack/react-table'
import { cn } from '@/lib/utils/cn'
import { TransferCard } from '@/components/transfers/cards/transfer-card'
import { EmptyState } from '@/components/ui/empty-state'
import { CARD_LIST_CLASS, CARD_SHELL_CLASS } from '@/components/ui/panel'
import { useTranslation } from '@/hooks/use-translation'
import type { TransferRowT } from '@/types/transfers'

type PropsT = {
  rows: Row<TransferRowT>[]
  uncoloredAmounts?: boolean
  className?: string
}

export function TransferCardList({ rows, uncoloredAmounts, className }: PropsT) {
  const { t } = useTranslation('filters')
  if (rows.length === 0) {
    return <EmptyState size="inline" title={t('noData')} />
  }

  return (
    <div className={cn(CARD_LIST_CLASS, className)}>
      {rows.map((row) => (
        <TransferCard
          key={row.id}
          row={row}
          uncoloredAmounts={uncoloredAmounts}
          className={CARD_SHELL_CLASS}
        />
      ))}
    </div>
  )
}
