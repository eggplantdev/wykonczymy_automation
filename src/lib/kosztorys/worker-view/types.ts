import type { KosztorysTreeT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { WorkerScopeBlockReasonT } from '@/lib/kosztorys/worker-view/scope'
import type { WorkerViewSettingsT } from '@/lib/kosztorys/worker-view/settings'
import type { WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'

export type WorkerAudienceT = {
  workerId: number
  name: string
  plane: ToolPlaneT
  summary: WorkerSummaryT
  settings: WorkerViewSettingsT
  // the tree below carries the worker's etapy alone, so an item another crew finished would otherwise
  // still read as owed.
  executedQtyByItem: Record<number, number>
}

export type WorkerKosztorysT =
  | {
      kind: 'ready'
      investmentId: number
      investmentName: string
      // `stages` and `progress` narrowed to the worker's etapy, so every downstream sum is his.
      tree: KosztorysTreeT
      worker: WorkerAudienceT
    }
  | {
      kind: 'blocked'
      reason: WorkerScopeBlockReasonT
      investmentName: string
      workerName: string
    }
