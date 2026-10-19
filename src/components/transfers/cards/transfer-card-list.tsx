'use client'

import type { Row } from '@tanstack/react-table'
import { cn } from '@/lib/utils/cn'
import { TransferCard } from '@/components/transfers/cards/transfer-card'
import { CARD_LIST_CLASS, CARD_SHELL_CLASS } from '@/components/transfers/cards/card-list-classes'
import { useTranslation } from '@/hooks/use-translation'
import type { TransferRowT } from '@/types/transfers'

type PropsT = {
  rows: Row<TransferRowT>[]
  visibleColumnIds: string[]
  uncoloredAmounts?: boolean
  className?: string
}

export function TransferCardList({ rows, visibleColumnIds, uncoloredAmounts, className }: PropsT) {
  const { t } = useTranslation('filters')
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{t('noData')}</p>
  }

  return (
    <div className={cn(CARD_LIST_CLASS, className)}>
      {rows.map((row) => (
        <TransferCard
          key={row.id}
          row={row}
          visibleColumnIds={visibleColumnIds}
          uncoloredAmounts={uncoloredAmounts}
          className={CARD_SHELL_CLASS}
        />
      ))}
    </div>
  )
}
