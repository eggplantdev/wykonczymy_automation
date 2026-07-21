import { describe, expect, it } from 'vitest'
import { computeSubcontractorSummary } from '@/lib/kosztorys/subcontractor-summary'
import type { SubcontractorPayoutRowT } from '@/types/reference-data'

const payout = (workerId: number | null, total: number, name = 'x'): SubcontractorPayoutRowT => ({
  workerId,
  total,
  name,
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

  it('sorts by total desc and pins the null-worker bucket last regardless of amount', () => {
    const { rows } = computeSubcontractorSummary(0, [
      payout(1, 100),
      payout(null, 999),
      payout(2, 300),
    ])
    expect(rows.map((row) => row.workerId)).toEqual([2, 1, null])
  })
})
