import { describe, expect, it } from 'vitest'

import { UNASSIGNED_WORKER_NAME, derivePayoutsByWorker } from '@/lib/kosztorys/payouts-by-worker'
import type { WorkerRefT } from '@/types/reference-data'
import type { PayoutTransactionRowT } from '@/types/transfers'

const workers = [
  { id: 1, name: 'Jan Kowalski', role: 'EMPLOYEE' },
  { id: 2, name: 'Anna Nowak', role: 'EMPLOYEE' },
] as WorkerRefT[]

const payout = (workerId: number | null, amount: number): PayoutTransactionRowT => ({
  type: 'PAYOUT',
  workerId,
  amount,
  date: '2026-07-18 09:00:00+00',
  description: null,
})

const rowFor = (workerId: number | null, rows: ReturnType<typeof derivePayoutsByWorker>) =>
  rows.find((row) => row.workerId === workerId)

describe('derivePayoutsByWorker', () => {
  it('sums a worker who has several wypłaty into one row', () => {
    const rows = derivePayoutsByWorker([payout(1, 1000), payout(1, 250.5), payout(2, 400)], workers)

    expect(rows).toHaveLength(2)
    expect(rowFor(1, rows)).toEqual({ workerId: 1, total: 1250.5, bonus: 0, name: 'Jan Kowalski' })
  })

  it('sums premie apart from wypłaty', () => {
    const rows = derivePayoutsByWorker(
      [payout(1, 1000), { ...payout(1, 205.01), type: 'BONUS' }],
      workers,
    )

    expect(rowFor(1, rows)).toEqual({
      workerId: 1,
      total: 1000,
      bonus: 205.01,
      name: 'Jan Kowalski',
    })
  })

  it('keeps the null-worker bucket as its own row rather than merging or dropping it', () => {
    const rows = derivePayoutsByWorker(
      [payout(1, 1000), payout(null, 300), payout(null, 200)],
      workers,
    )

    expect(rowFor(null, rows)).toEqual({
      workerId: null,
      total: 500,
      bonus: 0,
      name: UNASSIGNED_WORKER_NAME,
    })
    expect(rowFor(1, rows)?.total).toBe(1000)
  })

  it('labels a worker id the roster does not know rather than dropping the money', () => {
    const rows = derivePayoutsByWorker([payout(99, 750)], workers)

    expect(rowFor(99, rows)).toEqual({
      workerId: 99,
      total: 750,
      bonus: 0,
      name: 'Nieznany pracownik',
    })
  })

  it('rounds a grouped total to cents', () => {
    const rows = derivePayoutsByWorker([payout(1, 0.1), payout(1, 0.2)], workers)

    expect(rowFor(1, rows)?.total).toBe(0.3)
  })

  it('returns no rows for no wypłaty — the block renders a worker only from an assignment then', () => {
    expect(derivePayoutsByWorker([], workers)).toEqual([])
  })
})
