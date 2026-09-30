import { describe, expect, it } from 'vitest'
import {
  computeSubcontractorSummary,
  subcontractorRowTotals,
} from '@/lib/kosztorys/subcontractor-summary'
import type { WorkerRefT } from '@/types/reference-data'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { SubcontractorPayoutRowT } from '@/types/transfers'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-worker-split'

const payout = (workerId: number | null, total: number, name = 'x'): SubcontractorPayoutRowT => ({
  workerId,
  total,
  name,
})

const stage = (id: number, workerId: number | null): KosztorysStageT => ({
  id,
  ordinal: id,
  label: null,
  plane: 'w_tools',
  split: workerId == null ? null : oneWorkerSplit(workerId),
})

const worker = (id: number, name: string): WorkerRefT => ({
  id,
  name,
  role: 'EMPLOYEE',
  email: `${name.toLowerCase()}@t.com`,
})

describe('computeSubcontractorSummary', () => {
  it('sums payouts and leaves a positive remaining (należne − zaliczki)', () => {
    const { payoutsTotal, remaining } = computeSubcontractorSummary(1000, [
      payout(1, 300),
      payout(2, 200),
    ])
    expect(payoutsTotal).toBe(500)
    expect(remaining).toBe(500)
  })

  it('remaining goes negative when the crew is overpaid', () => {
    const { remaining } = computeSubcontractorSummary(400, [payout(1, 500)])
    expect(remaining).toBe(-100)
  })

  it('empty payouts → total 0, remaining equals należne', () => {
    const { payoutsTotal, remaining, rows } = computeSubcontractorSummary(700, [])
    expect(payoutsTotal).toBe(0)
    expect(remaining).toBe(700)
    expect(rows).toEqual([])
  })

  it('zero executed → remaining is the negated payouts total', () => {
    const { remaining } = computeSubcontractorSummary(0, [payout(1, 250)])
    expect(remaining).toBe(-250)
  })

  it('sorts by remaining desc and pins the null-worker bucket last regardless of amount', () => {
    const { rows } = computeSubcontractorSummary(0, [
      payout(1, 100),
      payout(null, 999),
      payout(2, 300),
    ])
    // With no należne every remaining is −paid, so the smallest payout is the least negative.
    expect(rows.map((row) => row.workerId)).toEqual([1, 2, null])
  })
})

// EX-613: rows are per person, over the union of both sides. The failure this guards against is a
// worker who is owed money going MISSING because they have no wypłata yet — the ledger alone would
// never mention them.
describe('computeSubcontractorSummary — per-worker attribution', () => {
  it('includes a worker with należne and no wypłaty at all', () => {
    const { rows } = computeSubcontractorSummary(500, [payout(1, 200, 'Anna')], {
      byWorker: new Map([
        [1, 200],
        [2, 300],
      ]),
      stages: [stage(10, 1), stage(11, 2)],
      workers: [worker(2, 'Bartek')],
    })
    expect(rows.map((row) => [row.workerId, row.due, row.paid, row.remaining])).toEqual([
      [2, 300, 0, 300],
      [1, 200, 200, 0],
    ])
    expect(rows[0].name).toBe('Bartek')
  })

  it('includes a worker with wypłaty and no etapy, at due 0', () => {
    const { rows } = computeSubcontractorSummary(0, [payout(3, 400, 'Celina')], {
      byWorker: new Map(),
      stages: [],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ workerId: 3, due: 0, paid: 400, remaining: -400 })
  })

  it('keeps the unassigned-etapy residual as its own row, never spread over the workers', () => {
    const { rows } = computeSubcontractorSummary(300, [], {
      byWorker: new Map([
        [1, 100],
        [null, 200],
      ]),
      stages: [stage(10, 1), stage(11, null)],
      workers: [worker(1, 'Anna')],
    })
    expect(rows.map((row) => [row.workerId, row.due])).toEqual([
      [1, 100],
      [null, 200],
    ])
  })

  it('drops an all-zero unassigned bucket but keeps an assigned worker with nothing done', () => {
    const { rows } = computeSubcontractorSummary(0, [], {
      byWorker: new Map(),
      stages: [stage(10, 1), stage(11, null)],
      workers: [worker(1, 'Anna')],
    })
    expect(rows.map((row) => row.workerId)).toEqual([1])
  })

  describe('the three kinds of red', () => {
    const stateFor = (due: number, paid: number, stages: KosztorysStageT[]): string | undefined => {
      const byWorker = due > 0 ? new Map([[1, due]]) : new Map<number | null, number>()
      return computeSubcontractorSummary(due, [payout(1, paid, 'Anna')], { byWorker, stages })
        .rows[0]?.state
    }

    it('overpaid — real work assigned, paid past it', () => {
      expect(stateFor(100, 150, [stage(10, 1)])).toBe('overpaid')
    })

    it('no_stages — paid, but nobody assigned them anything', () => {
      expect(stateFor(0, 150, [])).toBe('no_stages')
    })

    // Assigned but owed 0: nothing executed yet, OR the etapy still have no rozliczenie. Read off
    // `stages`, not off the money — a plane-less etap is absent from byWorker entirely.
    it('no_executed_work — etapy assigned, nothing earned on them yet', () => {
      expect(stateFor(0, 150, [stage(10, 1)])).toBe('no_executed_work')
      expect(
        stateFor(0, 150, [{ id: 10, ordinal: 1, label: null, plane: null, split: oneWorkerSplit(1) }]),
      ).toBe('no_executed_work')
    })

    it('settled — nothing negative to explain', () => {
      expect(stateFor(200, 150, [stage(10, 1)])).toBe('settled')
    })

    // `due` is a float sum over etap quantities, `paid` a Postgres SUM. Paying exactly what is owed
    // used to leave remaining at ~-1e-13, which rendered a square worker as a red „nadpłata -0,00".
    it('paying exactly the należne is settled, not a float-noise overpayment', () => {
      const due = 0.1 + 0.2
      const { rows } = computeSubcontractorSummary(due, [payout(1, 0.3, 'Anna')], {
        byWorker: new Map([[1, due]]),
        stages: [stage(10, 1)],
      })
      expect(rows[0]?.remaining).toBe(0)
      expect(rows[0]?.state).toBe('settled')
    })

    // EX-613 regression: `due` is Σ qty × viewPrice (fractional plane coefficients), `paid` a raw
    // SUM(amount) — neither rounded. Paying exactly the amount the UI displays left a −1e-13 residue,
    // which `remaining >= 0` read as overpaid: the row turned destructive-red and claimed „nadpłata"
    // while showing „pozostało -0,00". That is the paid-in-full case, i.e. the most common one.
    // 4.35 × 100 is 434.99999999999994 in binary floating point — it renders „435,00" and the owner
    // pays 435,00.
    const RESIDUE_DUE = 4.35 * 100

    it('settled — a worker paid exactly their displayed należne, float residue and all', () => {
      expect(stateFor(RESIDUE_DUE, 435, [stage(10, 1)])).toBe('settled')
    })

    it('a sub-grosz residue never survives into remaining', () => {
      const { rows } = computeSubcontractorSummary(RESIDUE_DUE, [payout(1, 435, 'Anna')], {
        byWorker: new Map([[1, RESIDUE_DUE]]),
        stages: [stage(10, 1)],
      })
      expect(rows[0].remaining).toBe(0)
    })

    // A real overpayment is still a grosz or more, so rounding must not swallow one.
    it('overpaid — a one-grosz overpayment survives the rounding', () => {
      expect(stateFor(100, 100.01, [stage(10, 1)])).toBe('overpaid')
    })
  })

  // The residual row is not a person, so neither person-shaped qualifier („brak przypisanych etapów"
  // / „przypisane etapy bez wykonanych prac") is a true sentence about it. Before EX-613's review it
  // got one or the other depending on whether ANY etap happened to be unassigned, because
  // `assignedWorkerIds` contains `null` itself.
  describe('the unattributed residual is not a person', () => {
    const nullRowState = (stages: KosztorysStageT[]) =>
      computeSubcontractorSummary(0, [payout(null, 200)], {
        byWorker: new Map(),
        stages,
      }).rows.find((row) => row.workerId === null)?.state

    it('carries its own state when some etapy are unassigned', () => {
      expect(nullRowState([stage(10, 1), stage(11, null)])).toBe('unattributed')
    })

    it('carries the same state when every etap is assigned', () => {
      expect(nullRowState([stage(10, 1)])).toBe('unattributed')
    })

    it('carries the same state when there are no etapy at all', () => {
      expect(nullRowState([])).toBe('unattributed')
    })

    it('leaves the named workers untouched', () => {
      const { rows } = computeSubcontractorSummary(0, [payout(1, 150, 'Anna'), payout(null, 200)], {
        byWorker: new Map(),
        stages: [stage(11, null)],
      })
      expect(rows.find((row) => row.workerId === 1)?.state).toBe('no_stages')
    })
  })
})

// „Razem" under the worker table and „Pozostało do wypłaty" in the block beside it are the same
// amount shown twice on one screen. In the 2026-08-25 rehearsal they read −131 494,73 and
// −131 494,72, because one side rounded each worker separately and only then added them up.
describe('subcontractorRowTotals — „Razem" cannot drift from the headline', () => {
  // 0.125 is exact in binary, so every row is a clean half-grosz rounded up: two rows rounded
  // separately come to 0,26 while together they are worth 0,25.
  const HALF_GROSZ_DUE = 0.125

  const summaryWithHalfGrosze = () =>
    computeSubcontractorSummary(HALF_GROSZ_DUE * 2, [], {
      byWorker: new Map([
        [1, HALF_GROSZ_DUE],
        [2, HALF_GROSZ_DUE],
      ]),
      stages: [stage(10, 1), stage(11, 2)],
    })

  it('sums należne at full precision, not after rounding the rows', () => {
    expect(subcontractorRowTotals(summaryWithHalfGrosze().rows).due).toBe(0.25)
  })

  it('reports the same „Pozostało do wypłaty" as the headline block', () => {
    const summary = summaryWithHalfGrosze()
    expect(subcontractorRowTotals(summary.rows).remaining).toBe(summary.remaining)
  })

  // The rounding is there to cancel noise, not a real gap: if attribution lost money, „Razem" must
  // show it rather than copy the headline's amount.
  it('still shows the gap when the rows do not add up to the headline', () => {
    const summary = computeSubcontractorSummary(1000, [], {
      byWorker: new Map([[1, 400]]),
      stages: [stage(10, 1)],
    })
    expect(subcontractorRowTotals(summary.rows).remaining).toBe(400)
    expect(summary.remaining).toBe(1000)
  })
})
