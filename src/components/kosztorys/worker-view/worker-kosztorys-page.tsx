import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/constants'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'

type PropsT = { data: WorkerKosztorysT }

// One render for the worker link and the owner's Podgląd, so the two cannot drift.
export function WorkerKosztorysPage({ data }: PropsT) {
  if (data.kind === 'blocked') {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-lg font-semibold">{data.investmentName}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{data.workerName}</p>
        <p className="mt-6 text-sm">{WORKER_SCOPE_BLOCK_MESSAGES[data.reason]}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-lg font-semibold">{data.investmentName}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{data.worker.name}</p>
    </main>
  )
}
