import { describe, it, expect } from 'vitest'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import {
  UNASSIGNED_PAIR_LABEL,
  type WorkerPayoutPairRowT,
  classifyPair,
  paidAheadOf,
  settleRowsForInvestment,
  settleRowsForWorker,
  workerColumnFigures,
  owedWorkersByInvestment,
} from '@/lib/kosztorys/worker-payout-pairs'

const pair = (overrides: Partial<WorkerPayoutPairRowT> = {}): WorkerPayoutPairRowT => ({
  investmentId: 1,
  workerId: 10,
  due: 1000,
  paid: 0,
  bonus: 0,
  hasUnconfirmedPlane: false,
  investmentStatus: 'active',
  ...overrides,
})

describe('classifyPair', () => {
  it.each([
    ['payable', pair({ paid: 400 })],
    ['settled', pair({ paid: 1000 })],
    ['overpaid', pair({ paid: 1200 })],
    ['locked', pair({ paid: 1200, investmentStatus: LOCKED_INVESTMENT_STATUS })],
    ['withheld', pair({ hasUnconfirmedPlane: true, investmentStatus: LOCKED_INVESTMENT_STATUS })],
    ['unassigned', pair({ workerId: null, hasUnconfirmedPlane: true })],
  ])('%s', (state, row) => {
    expect(classifyPair(row).state).toBe(state)
  })

  it('a premia equal to the nadpłata settles the pair', () => {
    const overpaid = pair({ due: 1000, paid: 1205.01 })
    expect(classifyPair(overpaid)).toMatchObject({ state: 'overpaid' })
    const evened = classifyPair({ ...overpaid, bonus: 205.01 })
    expect(evened.state).toBe('settled')
    expect(evened.remaining).toBeCloseTo(0, 10)
  })

  it('reads a float residue as settled, not as a nadpłata', () => {
    // 0.1 + 0.2 − 0.3 in the kwota planes lands at ~5.5e-17, not zero.
    expect(classifyPair(pair({ due: 0.1 + 0.2, paid: 0.3 })).state).toBe('settled')
    expect(classifyPair(pair({ due: 0.3, paid: 0.1 + 0.2 })).state).toBe('settled')
  })
})

describe('workerColumnFigures', () => {
  it('never nets a nadpłata against another investment', () => {
    const figures = workerColumnFigures([
      pair({ investmentId: 1, due: 3000 }),
      pair({ investmentId: 2, due: 500, paid: 1000 }),
    ])
    expect(figures.get(10)!.active).toEqual({
      owed: 3000,
      owedCount: 1,
      overpaid: 500,
      overpaidCount: 1,
      withheldCount: 0,
    })
  })

  it('still counts a zakończona inwestycja, in its own bucket — the debt is real, only booking is locked', () => {
    const figures = workerColumnFigures([
      pair({ investmentId: 1, due: 700, investmentStatus: LOCKED_INVESTMENT_STATUS }),
      pair({ investmentId: 2, due: 500, paid: 900, investmentStatus: LOCKED_INVESTMENT_STATUS }),
      pair({ investmentId: 3, due: 300 }),
    ])
    expect(figures.get(10)).toEqual({
      active: { owed: 300, owedCount: 1, overpaid: 0, overpaidCount: 0, withheldCount: 0 },
      completed: { owed: 700, owedCount: 1, overpaid: 400, overpaidCount: 1, withheldCount: 0 },
    })
  })

  it('marks a withheld pair instead of adding it', () => {
    const figures = workerColumnFigures([
      pair({ investmentId: 1, due: 700, hasUnconfirmedPlane: true }),
      pair({ investmentId: 2, due: 300 }),
    ])
    expect(figures.get(10)!.active).toEqual({
      owed: 300,
      owedCount: 1,
      overpaid: 0,
      overpaidCount: 0,
      withheldCount: 1,
    })
  })

  it('leaves the unassigned pair out — it is nobody on this list', () => {
    expect([...workerColumnFigures([pair({ workerId: null })]).keys()]).toEqual([])
  })

  it('rounds the sum once, not each pair', () => {
    // Three pairs of 0.005 each round to 0.01 apiece (0.03) but sum to 0.015 → 0.02.
    const figures = workerColumnFigures([
      pair({ investmentId: 1, due: 0.005 }),
      pair({ investmentId: 2, due: 0.005 }),
      pair({ investmentId: 3, due: 0.005 }),
    ])
    expect(figures.get(10)!.active.owed).toBe(0.02)
  })
})

describe('owedWorkersByInvestment', () => {
  it('counts the workers still owed, not the paid-up, withheld or unassigned ones', () => {
    const counts = owedWorkersByInvestment([
      pair({ investmentId: 1, workerId: 10, due: 500 }),
      pair({ investmentId: 1, workerId: 11, due: 300 }),
      pair({ investmentId: 1, workerId: 12, due: 300, paid: 300 }),
      pair({ investmentId: 1, workerId: 13, due: 300, hasUnconfirmedPlane: true }),
      pair({ investmentId: 1, workerId: null, due: 300 }),
      pair({ investmentId: 2, workerId: 10, due: 100, paid: 400 }),
    ])
    expect(counts.get(1)).toBe(2)
    expect(counts.has(2)).toBe(false)
  })
})

describe('settle rows', () => {
  const rows = [
    pair({ investmentId: 1, workerId: 10, due: 1000, paid: 200 }),
    pair({ investmentId: 1, workerId: 20, due: 500 }),
    pair({ investmentId: 1, workerId: null, due: 300, paid: 100 }),
    pair({ investmentId: 2, workerId: 10, due: 400 }),
  ]

  it('lists one investment’s workers by name, „Nieprzypisane" last', () => {
    const settle = settleRowsForInvestment(
      rows,
      1,
      new Map([
        [10, 'Zenon'],
        [20, 'Adam'],
      ]),
    )
    expect(settle.map((row) => row.label)).toEqual(['Adam', 'Zenon', UNASSIGNED_PAIR_LABEL])
  })

  it('makes „Nieprzypisane" the unassigned etapy minus the worker-less wypłaty', () => {
    const settle = settleRowsForInvestment(rows, 1, new Map())
    const unassigned = settle.at(-1)!
    expect(unassigned).toMatchObject({ due: 300, paid: 100, remaining: 200, state: 'unassigned' })
  })

  it('sums the investment rows to the listing figure', () => {
    const settle = settleRowsForInvestment(rows, 1, new Map())
    expect(settle.reduce((sum, row) => sum + row.remaining, 0)).toBe(1000 - 200 + 500 + 300 - 100)
  })

  it('lists one worker across investments', () => {
    const settle = settleRowsForWorker(
      rows,
      10,
      new Map([
        [1, 'Brzozowa'],
        [2, 'Akacjowa'],
      ]),
    )
    expect(settle.map((row) => [row.label, row.remaining])).toEqual([
      ['Akacjowa', 400],
      ['Brzozowa', 800],
    ])
  })
})

describe('settle rows without figures', () => {
  it('drops a pair with nothing executed and nothing paid from both entry points', () => {
    const rows = [
      pair({ investmentId: 1, workerId: 10, due: 0, paid: 0 }),
      pair({ investmentId: 2, workerId: 10, due: 500 }),
    ]
    expect(settleRowsForWorker(rows, 10, new Map()).map((r) => r.investmentId)).toEqual([2])
    expect(settleRowsForInvestment(rows, 1, new Map())).toEqual([])
  })

  it('keeps a withheld pair even at zero — its figure is unknown, not nothing', () => {
    const rows = [pair({ investmentId: 1, workerId: 10, due: 0, hasUnconfirmedPlane: true })]
    expect(settleRowsForWorker(rows, 10, new Map())).toHaveLength(1)
  })
})

describe('paidAheadOf', () => {
  it.each([
    ['within the remaining', 800, 500, 0],
    ['exactly the remaining', 800, 800, 0],
    ['above the remaining', 800, 1000, 200],
    ['on a settled pair', 0, 300, 300],
    ['on an overpaid pair — the old nadpłata is not counted again', -200, 300, 300],
  ])('%s', (_, remaining, amount, ahead) => {
    expect(paidAheadOf(remaining, amount)).toBe(ahead)
  })
})
