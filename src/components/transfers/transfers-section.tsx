import { Suspense } from 'react'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import type { TransferTableConfigT } from '@/types/export'

type TransfersSectionPropsT = {
  title?: string
  id?: string
  config: TransferTableConfigT
  className?: string
}

export function TransfersSection({ title = 'Transfery', id, config }: TransfersSectionPropsT) {
  return (
    <CollapsibleSection title={title} id={id}>
      <Suspense fallback={null}>
        <TransferTableServer config={config} />
      </Suspense>
    </CollapsibleSection>
  )
}
