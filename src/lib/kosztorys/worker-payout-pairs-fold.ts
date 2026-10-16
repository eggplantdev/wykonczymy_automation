import { splitStagePool } from '@/lib/kosztorys/stage-split'
import type { StageSplitT } from '@/lib/kosztorys/types'
import { pairKey, type WorkerPayoutPairRowT } from '@/lib/kosztorys/worker-payout-pairs'

export type StageDueRowT = {
  investmentId: number
  stageId: number
  due: number
  hasUnconfirmedPlane: boolean
}

export type PaidRowT = {
  investmentId: number
  workerId: number | null
  paid: number
  bonus: number
}

/** An etap member whose share is 0 still gets a pair, so the dialog can show them assigned. */
export function foldWorkerPayoutPairs(
  stageDue: StageDueRowT[],
  splits: ReadonlyMap<number, StageSplitT | null>,
  paid: PaidRowT[],
  statuses: ReadonlyMap<number, string>,
): WorkerPayoutPairRowT[] {
  const pairs = new Map<string, WorkerPayoutPairRowT>()
  const pairOf = (investmentId: number, workerId: number | null) => {
    const key = pairKey({ investmentId, workerId })
    let pair = pairs.get(key)
    if (!pair) {
      pair = {
        investmentId,
        workerId,
        due: 0,
        paid: 0,
        bonus: 0,
        hasUnconfirmedPlane: false,
        investmentStatus: statuses.get(investmentId) ?? '',
      }
      pairs.set(key, pair)
    }
    return pair
  }
  const credit = (row: StageDueRowT, workerId: number | null, amount: number) => {
    const pair = pairOf(row.investmentId, workerId)
    pair.due += amount
    pair.hasUnconfirmedPlane ||= row.hasUnconfirmedPlane
  }

  for (const row of stageDue) {
    const split = splits.get(row.stageId) ?? null
    const { shares, unattributed } = splitStagePool(row.due, split)
    for (const [workerId, share] of shares) credit(row, workerId, share)
    // An etap nobody is on reaches the null pair even at 0 zł, so its flag does too.
    if (!split || unattributed) credit(row, null, unattributed)
  }
  for (const row of paid) {
    const pair = pairOf(row.investmentId, row.workerId)
    pair.paid += row.paid
    pair.bonus += row.bonus
  }

  return [...pairs.values()]
}
