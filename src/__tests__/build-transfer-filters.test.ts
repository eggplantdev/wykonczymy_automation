import { describe, it, expect } from 'vitest'
import { buildTransferFilters } from '@/lib/queries/transfer-filters'

// ── Helpers ──────────────────────────────────────────────────────────────

const managerCtx = { id: 1 } as const
const employeeCtx = { id: 5 } as const

// ── Role scoping ─────────────────────────────────────────────────────────

describe('buildTransferFilters — role scoping', () => {
  it('onlyOwnTransfers adds createdBy filter', () => {
    const where = buildTransferFilters({}, { ...managerCtx, onlyOwnTransfers: true })
    expect(where.createdBy).toEqual({ equals: 1 })
  })

  it('onlyOwnTransfers ignores createdBy search param (security)', () => {
    const where = buildTransferFilters(
      { createdBy: '999' },
      { ...managerCtx, onlyOwnTransfers: true },
    )
    expect(where.createdBy).toEqual({ equals: 1 })
  })
})

// ── Search param filters ─────────────────────────────────────────────────

describe('buildTransferFilters — search params', () => {
  it('type param adds type filter', () => {
    const where = buildTransferFilters({ type: 'INVESTOR_DEPOSIT' }, managerCtx)
    expect(where.type).toEqual({ in: ['INVESTOR_DEPOSIT'] })
  })

  it('type param supports comma-separated multi-select', () => {
    const where = buildTransferFilters({ type: 'PAYOUT,OTHER' }, managerCtx)
    expect(where.type).toEqual({ in: ['PAYOUT', 'OTHER'] })
  })

  it('type param ignores invalid values', () => {
    const where = buildTransferFilters({ type: 'PAYOUT,GARBAGE' }, managerCtx)
    expect(where.type).toEqual({ in: ['PAYOUT'] })
  })

  it('sourceRegister param adds OR filter for source and target', () => {
    const where = buildTransferFilters({ sourceRegister: '3' }, managerCtx)
    expect(where.or).toEqual([{ sourceRegister: { in: [3] } }, { targetRegister: { in: [3] } }])
  })

  it('sourceRegister param supports multi-select', () => {
    const where = buildTransferFilters({ sourceRegister: '3,5' }, managerCtx)
    expect(where.or).toEqual([
      { sourceRegister: { in: [3, 5] } },
      { targetRegister: { in: [3, 5] } },
    ])
  })

  it('investment param adds numeric filter', () => {
    const where = buildTransferFilters({ investment: '10' }, managerCtx)
    expect(where.investment).toEqual({ in: [10] })
  })

  it('createdBy param adds numeric filter', () => {
    const where = buildTransferFilters({ createdBy: '7' }, managerCtx)
    expect(where.createdBy).toEqual({ in: [7] })
  })

  it('date range — from only', () => {
    const where = buildTransferFilters({ from: '2024-01-01' }, managerCtx)
    expect(where.date).toEqual({ greater_than_equal: '2024-01-01' })
  })

  it('date range — to only', () => {
    const where = buildTransferFilters({ to: '2024-12-31' }, managerCtx)
    expect(where.date).toEqual({ less_than_equal: '2024-12-31' })
  })

  it('date range — both from and to', () => {
    const where = buildTransferFilters({ from: '2024-01-01', to: '2024-12-31' }, managerCtx)
    expect(where.date).toEqual({
      greater_than_equal: '2024-01-01',
      less_than_equal: '2024-12-31',
    })
  })

  it('ignores array params', () => {
    const where = buildTransferFilters({ type: ['A', 'B'] }, managerCtx)
    expect(where.type).toEqual({ not_in: ['CANCELLATION'] })
  })

  it('no params excludes cancelled by default', () => {
    const where = buildTransferFilters({}, managerCtx)
    expect(where).toEqual({
      type: { not_in: ['CANCELLATION'] },
      cancelled: { not_equals: true },
    })
  })

  it('showCancelled=1 returns empty where', () => {
    const where = buildTransferFilters({ showCancelled: '1' }, managerCtx)
    expect(where).toEqual({})
  })

  it('combines multiple filters', () => {
    const where = buildTransferFilters(
      { type: 'INVESTMENT_EXPENSE', sourceRegister: '1', from: '2024-06-01' },
      managerCtx,
    )
    expect(where.type).toEqual({ in: ['INVESTMENT_EXPENSE'] })
    expect(where.or).toEqual([{ sourceRegister: { in: [1] } }, { targetRegister: { in: [1] } }])
    expect(where.date).toEqual({ greater_than_equal: '2024-06-01' })
  })

  it('paymentMethod param adds filter', () => {
    const where = buildTransferFilters({ paymentMethod: 'CASH' }, managerCtx)
    expect(where.paymentMethod).toEqual({ in: ['CASH'] })
  })

  it('paymentMethod param with invalid value returns no results', () => {
    const where = buildTransferFilters({ paymentMethod: 'INVALID' }, managerCtx)
    expect(where.id).toEqual({ equals: -1 })
  })

  it('otherCategory param adds numeric filter', () => {
    const where = buildTransferFilters({ otherCategory: '3' }, managerCtx)
    expect(where.otherCategory).toEqual({ in: [3] })
  })

  it('otherCategory param supports multi-select', () => {
    const where = buildTransferFilters({ otherCategory: '3,5' }, managerCtx)
    expect(where.otherCategory).toEqual({ in: [3, 5] })
  })
})

// ── Amount search ────────────────────────────────────────────────────────
// The `amount` column is `numeric` with max scale 2. Two search modes, switched
// by the presence of a decimal separator (EX-408):
//   • NO separator  → textual prefix on `amount::text` ("18" → 18, 189, 18000…).
//   • separator      → numeric half-open range [v, v + 10⁻ᵈ) where d = fractional
//     digits typed, so "18,00" pins to 18 (not 18949) and "18,1" spans 18.10–18.19.
// The range compares by numeric VALUE, sidestepping the stored ::text form which
// drops trailing zeros (a real 18.00 is stored "18").

describe('buildTransferFilters — amount search: prefix mode (no separator)', () => {
  it('"18" → textual prefix matching everything that starts with 18', () => {
    const where = buildTransferFilters({ amount: '18' }, managerCtx)
    expect(where.amount).toEqual({ like: '18' })
  })

  it('plain integer passes through unchanged', () => {
    const where = buildTransferFilters({ amount: '1000' }, managerCtx)
    expect(where.amount).toEqual({ like: '1000' })
  })

  it('"18000" → prefix, so it never matches a stored 18 (18,00)', () => {
    const where = buildTransferFilters({ amount: '18000' }, managerCtx)
    expect(where.amount).toEqual({ like: '18000' })
  })
})

describe('buildTransferFilters — amount search: range mode (separator present)', () => {
  it('"18,00" → [18, 18.01): finds a clean 18, excludes 18949 / 18000,99', () => {
    const where = buildTransferFilters({ amount: '18,00' }, managerCtx)
    expect(where.amount).toEqual({ greater_than_equal: 18, less_than: 18.01 })
  })

  it('"18.00" (dot) behaves identically to the comma form', () => {
    const where = buildTransferFilters({ amount: '18.00' }, managerCtx)
    expect(where.amount).toEqual({ greater_than_equal: 18, less_than: 18.01 })
  })

  it('"18,1" → [18.1, 18.2): 18 with a fraction starting 1 (18.10–18.19)', () => {
    const where = buildTransferFilters({ amount: '18,1' }, managerCtx)
    expect(where.amount).toEqual({ greater_than_equal: 18.1, less_than: 18.2 })
  })

  it('"18,11" → [18.11, 18.12): pins to 18,11 (2-decimal max ⇒ de facto exact)', () => {
    const where = buildTransferFilters({ amount: '18,11' }, managerCtx)
    expect(where.amount).toEqual({ greater_than_equal: 18.11, less_than: 18.12 })
  })

  it('"181,6" → [181.6, 181.7): matches 181,6 and 181,69', () => {
    const where = buildTransferFilters({ amount: '181,6' }, managerCtx)
    expect(where.amount).toEqual({ greater_than_equal: 181.6, less_than: 181.7 })
  })

  it('"181,69" → [181.69, 181.7): pins to 181,69', () => {
    const where = buildTransferFilters({ amount: '181,69' }, managerCtx)
    expect(where.amount).toEqual({ greater_than_equal: 181.69, less_than: 181.7 })
  })

  it('"72,4" → [72.4, 72.5)', () => {
    const where = buildTransferFilters({ amount: '72,4' }, managerCtx)
    expect(where.amount).toEqual({ greater_than_equal: 72.4, less_than: 72.5 })
  })

  it('"72,40" → [72.4, 72.41): the trailing zero narrows, not widens', () => {
    const where = buildTransferFilters({ amount: '72,40' }, managerCtx)
    expect(where.amount).toEqual({ greater_than_equal: 72.4, less_than: 72.41 })
  })

  it('trailing separator with no fraction ("18,") pins the integer → [18, 19)', () => {
    const where = buildTransferFilters({ amount: '18,' }, managerCtx)
    expect(where.amount).toEqual({ greater_than_equal: 18, less_than: 19 })
  })
})

describe('buildTransferFilters — amount search: rejected input', () => {
  it('ignores non-numeric input', () => {
    const where = buildTransferFilters({ amount: 'abc' }, managerCtx)
    expect(where.amount).toBeUndefined()
  })

  it('ignores a leading separator with no integer part', () => {
    const where = buildTransferFilters({ amount: ',5' }, managerCtx)
    expect(where.amount).toBeUndefined()
  })
})
