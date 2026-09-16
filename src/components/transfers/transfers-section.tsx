import { Suspense } from 'react'
import { TransferTableServer } from '@/components/transfers/transfer-table-server'
import type { TransferTableConfigT } from '@/components/transfers/transfer-table-config'

type TransfersSectionPropsT = {
  /** Omit for a table that needs no heading — the page title already names it. */
  title?: string
  id?: string
  config: TransferTableConfigT
  className?: string
}

export function TransfersSection({ title, id, config }: TransfersSectionPropsT) {
  return (
    <section id={id}>
      <Suspense fallback={null}>
        <TransferTableServer config={{ ...config, title }} />
      </Suspense>
    </section>
  )
}
