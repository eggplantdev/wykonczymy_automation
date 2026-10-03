import { describe, it, expect } from 'vitest'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { type StageDueRowT, foldWorkerPayoutPairs } from '@/lib/kosztorys/worker-payout-pairs-fold'
import type { WorkerPayoutPairRowT } from '@/lib/kosztorys/worker-payout-pairs'
import type { StageSplitT } from '@/lib/kosztorys/types'

describe('foldWorkerPayoutPairs', () => {
  const stage = (overrides: Partial<StageDueRowT> = {}): StageDueRowT => ({
    investmentId: 1,
    stageId: 100,
    due: 1000,
    hasUnconfirmedPlane: false,
    ...overrides,
  })
  const percent: StageSplitT = {
    mode: 'percent',
    members: [
      { workerId: 10, value: 30, takesRest: false },
      { workerId: 20, value: 0, takesRest: true },
    ],
  }
  const amount: StageSplitT = {
    mode: 'amount',
    members: [
      { workerId: 10, value: 600, takesRest: false },
      { workerId: 20, value: 0, takesRest: true },
    ],
  }
  const statuses = new Map([[1, 'active']])
  const byWorker = (rows: WorkerPayoutPairRowT[]) =>
    Object.fromEntries(rows.map((row) => [String(row.workerId), row]))

  it('credits each member their percent share, the rest holder the remainder', () => {
    const rows = foldWorkerPayoutPairs([stage()], new Map([[100, percent]]), [], statuses)
    expect(byWorker(rows)['10'].due).toBeCloseTo(300)
    expect(byWorker(rows)['20'].due).toBeCloseTo(700)
    expect(byWorker(rows)['null']).toBeUndefined()
  })

  it('credits a fixed amount as entered, the rest holder the remainder', () => {
    const rows = foldWorkerPayoutPairs([stage()], new Map([[100, amount]]), [], statuses)
    expect(byWorker(rows)['10'].due).toBe(600)
    expect(byWorker(rows)['20'].due).toBe(400)
  })

  it('shrinks fixed amounts pro rata when the pool fell below them, the rest holder gets 0', () => {
    const rows = foldWorkerPayoutPairs(
      [stage({ due: 300 })],
      new Map([[100, amount]]),
      [],
      statuses,
    )
    expect(byWorker(rows)['10'].due).toBe(300)
    expect(byWorker(rows)['20'].due).toBe(0)
  })

  it('flags every member of a plane-less etap', () => {
    const rows = foldWorkerPayoutPairs(
      [stage({ due: 0, hasUnconfirmedPlane: true })],
      new Map([[100, percent]]),
      [],
      statuses,
    )
    expect(rows.map((row) => [row.workerId, row.due, row.hasUnconfirmedPlane])).toEqual([
      [10, 0, true],
      [20, 0, true],
    ])
  })

  it('feeds an etap without workers to the unassigned pair', () => {
    const rows = foldWorkerPayoutPairs([stage({ due: 500 })], new Map(), [], statuses)
    expect(rows).toEqual([
      {
        investmentId: 1,
        workerId: null,
        due: 500,
        paid: 0,
        bonus: 0,
        hasUnconfirmedPlane: false,
        investmentStatus: 'active',
      },
    ])
  })

  it('keeps a negative pool on the unassigned pair — no share is negative', () => {
    const rows = foldWorkerPayoutPairs(
      [stage({ due: -200 })],
      new Map([[100, percent]]),
      [],
      statuses,
    )
    expect(byWorker(rows)['10'].due).toBe(0)
    expect(byWorker(rows)['20'].due).toBe(0)
    expect(byWorker(rows)['null'].due).toBe(-200)
  })

  it('leaves no unassigned pair behind on a float residue of a full split', () => {
    const split: StageSplitT = {
      mode: 'percent',
      members: [
        { workerId: 10, value: 33.33, takesRest: false },
        { workerId: 30, value: 12.5, takesRest: false },
        { workerId: 20, value: 0, takesRest: true },
      ],
    }
    const rows = foldWorkerPayoutPairs(
      [stage({ due: 32593.76 })],
      new Map([[100, split]]),
      [],
      statuses,
    )
    expect(byWorker(rows)['null']).toBeUndefined()
  })

  it('sums one worker across two etapy and adds a wypłata even with no etap', () => {
    const rows = foldWorkerPayoutPairs(
      [stage(), stage({ stageId: 101, due: 200 })],
      new Map([
        [100, percent],
        [101, { mode: 'percent', members: [{ workerId: 10, value: 0, takesRest: true }] }],
      ]),
      [
        { investmentId: 1, workerId: 10, paid: 150, bonus: 25 },
        { investmentId: 2, workerId: 30, paid: 80, bonus: 0 },
      ],
      new Map([
        [1, 'active'],
        [2, LOCKED_INVESTMENT_STATUS],
      ]),
    )
    expect(byWorker(rows)['10']).toMatchObject({ due: 500, paid: 150, bonus: 25 })
    expect(byWorker(rows)['30']).toMatchObject({
      investmentId: 2,
      due: 0,
      paid: 80,
      investmentStatus: LOCKED_INVESTMENT_STATUS,
    })
  })
})
