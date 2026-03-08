import { describe, it, expect } from 'vitest'
import { buildTransferFilters } from '@/lib/queries/transfers'

// ── Helpers ──────────────────────────────────────────────────────────────

const managerCtx = { id: 1, isManager: true } as const
const employeeCtx = { id: 5, isManager: false } as const

// ── Role scoping ─────────────────────────────────────────────────────────

describe('buildTransferFilters — role scoping', () => {
  it('EMPLOYEE always filters by own worker ID', () => {
    const where = buildTransferFilters({}, employeeCtx)
    expect(where.worker).toEqual({ equals: 5 })
  })

  it('manager does NOT add worker filter', () => {
    const where = buildTransferFilters({}, managerCtx)
    expect(where.worker).toBeUndefined()
  })

  it('onlyOwnTransfers adds createdBy filter', () => {
    const where = buildTransferFilters({}, { ...managerCtx, onlyOwnTransfers: true })
    expect(where.createdBy).toEqual({ equals: 1 })
  })

  it('EMPLOYEE + onlyOwnTransfers has both filters', () => {
    const where = buildTransferFilters({}, { ...employeeCtx, onlyOwnTransfers: true })
    expect(where.worker).toEqual({ equals: 5 })
    expect(where.createdBy).toEqual({ equals: 5 })
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

  it('sourceRegister param adds numeric filter', () => {
    const where = buildTransferFilters({ sourceRegister: '3' }, managerCtx)
    expect(where.sourceRegister).toEqual({ in: [3] })
  })

  it('sourceRegister param supports multi-select', () => {
    const where = buildTransferFilters({ sourceRegister: '3,5' }, managerCtx)
    expect(where.sourceRegister).toEqual({ in: [3, 5] })
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
    expect(where.type).toBeUndefined()
  })

  it('no params returns empty where (for manager)', () => {
    const where = buildTransferFilters({}, managerCtx)
    expect(where).toEqual({})
  })

  it('combines multiple filters', () => {
    const where = buildTransferFilters(
      { type: 'EMPLOYEE_EXPENSE', sourceRegister: '1', from: '2024-06-01' },
      managerCtx,
    )
    expect(where.type).toEqual({ in: ['EMPLOYEE_EXPENSE'] })
    expect(where.sourceRegister).toEqual({ in: [1] })
    expect(where.date).toEqual({ greater_than_equal: '2024-06-01' })
  })

  it('worker param adds numeric filter', () => {
    const where = buildTransferFilters({ worker: '10' }, managerCtx)
    expect(where.worker).toEqual({ in: [10] })
  })

  it('worker param supports multi-select', () => {
    const where = buildTransferFilters({ worker: '10,20' }, managerCtx)
    expect(where.worker).toEqual({ in: [10, 20] })
  })

  it('worker param with invalid value returns no results', () => {
    const where = buildTransferFilters({ worker: 'abc' }, managerCtx)
    expect(where.id).toEqual({ equals: -1 })
  })

  it('employee worker filter takes precedence over worker param', () => {
    const where = buildTransferFilters({ worker: '10' }, employeeCtx)
    expect(where.worker).toEqual({ equals: 5 })
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
