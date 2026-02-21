import { Suspense } from 'react'
import type { Where } from 'payload'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import { TransferTableSkeleton } from '@/components/transfers/transfer-table-skeleton'
import type { FilterConfigT } from '@/types/filters'

type TransfersSectionPropsT = {
  readonly title?: string
  readonly where: Where
  readonly page: number
  readonly limit: number
  readonly baseUrl: string
  readonly excludeColumns?: string[]
  readonly filters?: FilterConfigT
  readonly className?: string
}

export function TransfersSection({
  title = 'Transfery',
  where,
  page,
  limit,
  baseUrl,
  excludeColumns,
  filters,
  className,
}: TransfersSectionPropsT) {
  return (
    <CollapsibleSection title={title} className={className}>
      <Suspense fallback={<TransferTableSkeleton />}>
        <TransferTableServer
          where={where}
          page={page}
          limit={limit}
          excludeColumns={excludeColumns}
          baseUrl={baseUrl}
          filters={filters}
          className="mt-4"
        />
      </Suspense>
    </CollapsibleSection>
  )
}
