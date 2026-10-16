import { viewPrice } from '@/lib/kosztorys/calc'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { splitStagePool } from '@/lib/kosztorys/stage-split'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

export type SubcontractorSettlementT = {
  /** Executed work valued pre-rabat, each etap at its own plane. */
  due: number
  /** Some etap holds executed work with no settlement plane, so `due` is short by an unknown amount. */
  hasUnconfirmedPlane: boolean
}

export const NOTHING_DUE: SubcontractorSettlementT = { due: 0, hasUnconfirmedPlane: false }

export type SubcontractorDueByPlaneT = {
  wTools: number
  ownTools: number
  combined: number
  hasUnconfirmedPlane: boolean
  byStage: Map<number, number>
  // a worker spanning both planes is NOT derivable from `wTools`/`ownTools`; only this map knows.
  byWorker: Map<number | null, number>
  byStageWorker: Map<number, Map<number | null, number>>
  scaledDownStageIds: Set<number>
  unconfirmedWorkers: Set<number | null>
}

export function subcontractorDueByPlane(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
): SubcontractorDueByPlaneT {
  let wTools = 0
  let ownTools = 0
  const unconfirmedWorkers = new Set<number | null>()
  const byStage = new Map<number, number>()
  const byWorker = new Map<number | null, number>()
  const byStageWorker = new Map<number, Map<number | null, number>>()
  const scaledDownStageIds = new Set<number>()
  const credit = (workerId: number | null, amount: number) =>
    byWorker.set(workerId, (byWorker.get(workerId) ?? 0) + amount)
  for (const st of stages) {
    const plane = st.plane
    const key = stageKey(st.id)
    if (plane === null) {
      // Gated on the etap actually holding qty: the badge this drives claims the sum is SHORT, and a
      // freshly added empty etap makes that claim false
      if (rows.some((row) => row[key])) {
        if (st.split) for (const member of st.split.members) unconfirmedWorkers.add(member.workerId)
        else unconfirmedWorkers.add(null)
      }
      continue
    }
    let planeTotal = 0
    for (const row of rows) {
      const qty = row[key] ?? 0
      if (qty) planeTotal += qty * viewPrice(row, plane)
    }
    if (plane === 'w_tools') wTools += planeTotal
    else ownTools += planeTotal
    byStage.set(st.id, planeTotal)
    const { shares, unattributed, scaledDown } = splitStagePool(planeTotal, st.split)
    const stageShares = new Map<number | null, number>(shares)
    if (!st.split || unattributed) stageShares.set(null, unattributed)
    for (const [workerId, share] of stageShares) credit(workerId, share)
    byStageWorker.set(st.id, stageShares)
    if (scaledDown) scaledDownStageIds.add(st.id)
  }
  return {
    wTools,
    ownTools,
    combined: wTools + ownTools,
    hasUnconfirmedPlane: unconfirmedWorkers.size > 0,
    byStage,
    byWorker,
    byStageWorker,
    scaledDownStageIds,
    unconfirmedWorkers,
  }
}

export function toSettlement(byPlane: SubcontractorDueByPlaneT): SubcontractorSettlementT {
  return { due: byPlane.combined, hasUnconfirmedPlane: byPlane.hasUnconfirmedPlane }
}
