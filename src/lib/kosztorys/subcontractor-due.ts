import { viewPrice } from '@/lib/kosztorys/calc'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { splitStagePool } from '@/lib/kosztorys/stage-split'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/** The crew side of the margin, as `subcontractorDueByPlane` reports it — the amount and the reason
 *  it may be short. Taken as one object so a caller cannot pass the amount and drop the caveat. */
export type SubcontractorSettlementT = {
  /** Executed work valued pre-rabat, each etap at its own plane. */
  due: number
  /** Some etap holds executed work with no settlement plane, so `due` is short by an unknown amount. */
  hasUnconfirmedPlane: boolean
}

/** No kosztorys, or one nobody has executed anything in. A fact, not a missing input — nothing is
 *  owed to a crew for work nobody entered. Shared so the listing, the golden master and the specs
 *  cannot disagree about what "nothing" looks like. */
export const NOTHING_DUE: SubcontractorSettlementT = { due: 0, hasUnconfirmedPlane: false }

export type SubcontractorDueByPlaneT = {
  wTools: number
  ownTools: number
  combined: number
  hasUnconfirmedPlane: boolean
  // Per-etap executed value at that etap's own plane — the `planeTotal` the loop already holds.
  // Emitted so the header's reassignment confirm quotes the same figure the panel does instead of
  // recomputing it inline. A plane-less etap has no entry: it contributes to no bill.
  byStage: Map<number, number>
  // The same money partitioned by WHO is to do it (EX-613), each etap divided by its split
  // (`splitStagePool`, EX-943); `null` = etapy with nobody assigned. Σ values === `combined` by
  // construction — the residual is its own entry, never spread over the assigned workers. Two
  // consequences:
  // - a worker spanning both planes is NOT derivable from `wTools`/`ownTools`; only this map knows.
  // - a plane-less etap credits nobody, assigned or not — it is skipped before this map is touched,
  //   so a worker can hold etapy and still owe 0 (`hasUnconfirmedPlane` is what says why).
  byWorker: Map<number | null, number>
  // `byWorker` one level finer, per etap — a worker's share of each etap for the worker view. An etap
  // with nobody assigned has no entry.
  byStageWorker: Map<number, Map<number, number>>
  scaledDownStageIds: Set<number>
  // Every member of a plane-less etap WITH executed qty (`null` = unassigned) — the per-worker half of
  // `hasUnconfirmedPlane`, which is exactly `unconfirmedWorkers.size > 0`. No app surface reads it:
  // it is the reference the SQL per-worker flag (`lib/db/worker-payout-pairs.ts`) is pinned to.
  unconfirmedWorkers: Set<number | null>
}

/**
 * The view-independent subcontractor settlement: each etap's executed qty valued PRE-rabat at that
 * etap's OWN plane, summed per plane and combined. This is the honest money „Podsumowanie
 * podwykonawców" shows — unlike the per-view passes, which reprice 100% of executed work at one
 * plane's price and so double-count on a mixed investment (per etap the relationship is OR: one crew
 * executed it, at one plane's price).
 *
 * Per-stage value = `stageQty × viewPrice(row, plane)`. Pre-rabat is LINEAR in qty (the
 * `rowDiscountForView` identity: `qty·viewPrice − netForQtyForView = discount`), so no qty-share
 * splitting and no discount handling — rabat is a client concession the crew is still owed past, and
 * a global discount never reaches subcontractors either. For a single-plane investment the per-stage
 * sum collapses to `totalQty × viewPrice`, i.e. exactly `sumSectionSubtotalsNet` at that view.
 *
 * A `null` plane belongs to neither crew — it is skipped and raises `hasUnconfirmedPlane`: the two
 * amounts render short, the warning sits next to them (recon-mismatch pattern).
 */
export function subcontractorDueByPlane(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
): SubcontractorDueByPlaneT {
  let wTools = 0
  let ownTools = 0
  const unconfirmedWorkers = new Set<number | null>()
  const byStage = new Map<number, number>()
  const byWorker = new Map<number | null, number>()
  const byStageWorker = new Map<number, Map<number, number>>()
  const scaledDownStageIds = new Set<number>()
  const credit = (workerId: number | null, amount: number) =>
    byWorker.set(workerId, (byWorker.get(workerId) ?? 0) + amount)
  for (const st of stages) {
    const plane = st.plane
    const key = stageKey(st.id)
    if (plane === null) {
      // Gated on the etap actually holding qty: the badge this drives claims the sum is SHORT, and a
      // freshly added empty etap makes that claim false — it would scream about missing money that
      // does not exist yet.
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
    for (const [workerId, share] of shares) credit(workerId, share)
    if (!st.split || unattributed) credit(null, unattributed)
    if (st.split) byStageWorker.set(st.id, shares)
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

/** The per-plane fold narrowed to what a margin reader needs. One projection instead of a literal
 *  rewritten at each call site, so a future field on `SubcontractorSettlementT` cannot be missed by
 *  one of them. */
export function toSettlement(byPlane: SubcontractorDueByPlaneT): SubcontractorSettlementT {
  return { due: byPlane.combined, hasUnconfirmedPlane: byPlane.hasUnconfirmedPlane }
}
