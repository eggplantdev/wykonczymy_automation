import type { KosztorysTreeT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { WorkerScopeBlockReasonT } from '@/lib/kosztorys/worker-view/scope'
import type { WorkerViewSettingsT } from '@/lib/kosztorys/worker-view/settings'
import type { WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'

// Everything the worker surface needs beyond the tree — kept apart from `preview`, which is a
// read-only render flag and not an audience.
export type WorkerAudienceT = {
  workerId: number
  name: string
  plane: ToolPlaneT
  summary: WorkerSummaryT
  settings: WorkerViewSettingsT
  // Σ qty over EVERY etap of the investment per item, for „Pozostało" only (design #9): the tree
  // below carries the worker's etapy alone, so an item another crew finished would otherwise still
  // read as owed. Never an input to the empty-rows rule, whose executed axis is his etapy.
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

// The two links a worker can hold: his rozpiska to read, and the form he reports his work through.
export type WorkerLinkKindT = 'rozpiska' | 'report'
