import { Suspense } from 'react'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import type { TransferTableConfigT } from '@/types/export'

type TransfersSectionPropsT = {
  readonly title?: string
  readonly config: TransferTableConfigT
  readonly className?: string
}

export function TransfersSection({ title = 'Transfery', config }: TransfersSectionPropsT) {
  return (
    <CollapsibleSection title={title}>
      <Suspense fallback={null}>
        <TransferTableServer config={config} />
      </Suspense>
    </CollapsibleSection>
  )
}
