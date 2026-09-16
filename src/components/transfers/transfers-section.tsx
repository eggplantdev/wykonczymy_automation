import { Suspense } from 'react'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import type { TransferTableConfigT } from '@/components/transfers/transfer-table-config'

type TransfersSectionPropsT = {
  title?: string
  id?: string
  config: TransferTableConfigT
  className?: string
}

export function TransfersSection({ title = 'Transfery', id, config }: TransfersSectionPropsT) {
  return (
    <section id={id}>
      <Suspense fallback={null}>
        <TransferTableServer config={{ ...config, title }} />
      </Suspense>
    </section>
  )
}
