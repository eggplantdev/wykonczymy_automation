import { Suspense } from 'react'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import type { FilterConfigT } from '@/types/filters'
import type { ExportContextT } from '@/types/export'
import type { TransferQueryT } from '@/types/transfer-query'

type TransfersSectionPropsT = {
  readonly title?: string
  readonly query: TransferQueryT
  readonly baseUrl: string
  readonly excludeColumns?: string[]
  readonly filters?: FilterConfigT
  readonly context?: ExportContextT
  readonly contextId?: number
  readonly className?: string
}

export function TransfersSection({
  title = 'Transfery',
  query,
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
          query={query}
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
