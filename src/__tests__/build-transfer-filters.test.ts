import { describe, it, expect } from 'vitest'
import { buildTransferFilters } from '@/lib/queries/transfer-filters'

const managerCtx = { id: 1 } as const

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

describe('buildTransferFilters — search params', () => {
  it.each<[string, Record<string, string>, string, unknown]>([
    [
      'type param adds type filter',
      { type: 'INVESTOR_DEPOSIT' },
      'type',
      { in: ['INVESTOR_DEPOSIT'] },
    ],
    [
      'type param supports multi-select',
      { type: 'PAYOUT,OTHER' },
      'type',
      { in: ['PAYOUT', 'OTHER'] },
    ],
    ['type param ignores invalid values', { type: 'PAYOUT,GARBAGE' }, 'type', { in: ['PAYOUT'] }],
    [
      'sourceRegister matches source or target',
      { sourceRegister: '3' },
      'or',
      [{ sourceRegister: { in: [3] } }, { targetRegister: { in: [3] } }],
    ],
    [
      'sourceRegister supports multi-select',
      { sourceRegister: '3,5' },
      'or',
      [{ sourceRegister: { in: [3, 5] } }, { targetRegister: { in: [3, 5] } }],
    ],
    ['investment param adds numeric filter', { investment: '10' }, 'investment', { in: [10] }],
    ['createdBy param adds numeric filter', { createdBy: '7' }, 'createdBy', { in: [7] }],
    [
      'date range — from only',
      { from: '2024-01-01' },
      'date',
      { greater_than_equal: '2024-01-01' },
    ],
    ['date range — to only', { to: '2024-12-31' }, 'date', { less_than_equal: '2024-12-31' }],
    [
      'date range — both from and to',
      { from: '2024-01-01', to: '2024-12-31' },
      'date',
      { greater_than_equal: '2024-01-01', less_than_equal: '2024-12-31' },
    ],
    [
      'paymentMethod param adds filter',
      { paymentMethod: 'CASH' },
      'paymentMethod',
      { in: ['CASH'] },
    ],
    [
      'paymentMethod with an invalid value → no results',
      { paymentMethod: 'INVALID' },
      'id',
      { equals: -1 },
    ],
    [
      'otherCategory param adds numeric filter',
      { otherCategory: '3' },
      'otherCategory',
      { in: [3] },
    ],
    [
      'otherCategory supports multi-select',
      { otherCategory: '3,5' },
      'otherCategory',
      { in: [3, 5] },
    ],
    [
      'a single worker id from the subcontractor summary link',
      { worker: '5' },
      'worker',
      { in: [5] },
    ],
    ['worker param supports multi-select', { worker: '3,7' }, 'worker', { in: [3, 7] }],
    [
      'drops only the unusable worker ids from a mixed list',
      { worker: '3,1e999,7' },
      'worker',
      { in: [3, 7] },
    ],
  ])('%s', (_title, params, key, expected) => {
    expect(buildTransferFilters(params, managerCtx)[key]).toEqual(expected)
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

  // `1e999` parses to Infinity, which is truthy, so a non-integer id must die in the parser or it
  // reaches raw SQL as a bare `worker_id IN (infinity)` identifier and 500s the page.
  it.each(['1e999', '-1e999', '1.5', 'NaN', 'Infinity'])(
    'worker param %p never reaches the query as a number',
    (worker) => {
      const where = buildTransferFilters({ worker }, managerCtx)
      expect(where.worker).toBeUndefined()
      expect(where.id).toEqual({ equals: -1 })
    },
  )

  it('worker param with no usable id → no results', () => {
    const where = buildTransferFilters({ worker: 'abc' }, managerCtx)
    expect(where.worker).toBeUndefined()
    expect(where.id).toEqual({ equals: -1 })
  })
})

describe('buildTransferFilters — amount search', () => {
  it.each<[string, string, unknown]>([
    ['no separator → textual prefix of everything starting with 18', '18', { like: '18' }],
    ['"18000" → prefix, so it never matches a stored 18 (18,00)', '18000', { like: '18000' }],
    [
      '"18,00" → [18, 18.01): a clean 18, not 18949 / 18000,99',
      '18,00',
      { greater_than_equal: 18, less_than: 18.01 },
    ],
    [
      '"18.00" (dot) behaves like the comma form',
      '18.00',
      { greater_than_equal: 18, less_than: 18.01 },
    ],
    ['"18,1" → [18.1, 18.2): 18.10–18.19', '18,1', { greater_than_equal: 18.1, less_than: 18.2 }],
    [
      '"18,11" → [18.11, 18.12): de facto exact',
      '18,11',
      { greater_than_equal: 18.11, less_than: 18.12 },
    ],
    [
      '"181,6" → [181.6, 181.7): 181,6 and 181,69',
      '181,6',
      { greater_than_equal: 181.6, less_than: 181.7 },
    ],
    ['"181,69" → [181.69, 181.7)', '181,69', { greater_than_equal: 181.69, less_than: 181.7 }],
    ['"72,4" → [72.4, 72.5)', '72,4', { greater_than_equal: 72.4, less_than: 72.5 }],
    [
      '"72,40" → [72.4, 72.41): a trailing zero narrows',
      '72,40',
      { greater_than_equal: 72.4, less_than: 72.41 },
    ],
    ['"18," pins the integer → [18, 19)', '18,', { greater_than_equal: 18, less_than: 19 }],
    ['ignores non-numeric input', 'abc', undefined],
    ['ignores a leading separator with no integer part', ',5', undefined],
  ])('%s', (_title, amount, expected) => {
    expect(buildTransferFilters({ amount }, managerCtx).amount).toEqual(expected)
  })
})
