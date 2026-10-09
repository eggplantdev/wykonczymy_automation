'use client'

import type { Row } from '@tanstack/react-table'
import { cn } from '@/lib/utils/cn'
import { TransferCard } from '@/components/transfers/cards/transfer-card'
import { useTranslation } from '@/hooks/use-translation'
import type { TransferRowT } from '@/types/transfers'

type PropsT = {
  rows: Row<TransferRowT>[]
  className?: string
}

export function TransferCardList({ rows, className }: PropsT) {
  const { t } = useTranslation('filters')
  if (rows.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{t('noData')}</p>
  }

  return (
    <div
      className={cn(
        'max-sm:divide-border max-sm:border-border w-full max-sm:divide-y max-sm:overflow-hidden max-sm:rounded-lg max-sm:border sm:max-w-3xl sm:space-y-3',
        className,
      )}
    >
      {rows.map((row) => (
        <TransferCard
          key={row.id}
          row={row}
          className="bg-background sm:border-border sm:rounded-lg sm:border sm:shadow-sm"
        />
      ))}
    </div>
  )
}
