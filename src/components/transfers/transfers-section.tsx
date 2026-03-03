import { Suspense } from 'react'
import type { Where } from 'payload'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import type { FilterConfigT } from '@/types/filters'
import type { ExportContextT } from '@/types/export'

type TransfersSectionPropsT = {
  readonly title?: string
  readonly where: Where
  readonly page: number
  readonly limit: number
  readonly baseUrl: string
  readonly excludeColumns?: string[]
  readonly filters?: FilterConfigT
  readonly context?: ExportContextT
  readonly contextId?: number
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
  context,
  contextId,
  className,
}: TransfersSectionPropsT) {
  return (
    <CollapsibleSection title={title} className={className}>
      <Suspense fallback={null}>
        <TransferTableServer
          where={where}
          page={page}
          limit={limit}
          excludeColumns={excludeColumns}
          baseUrl={baseUrl}
          filters={filters}
          context={context}
          contextId={contextId}
          className="mt-4"
        />
      </Suspense>
    </CollapsibleSection>
  )
}
