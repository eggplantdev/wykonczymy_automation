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
})

// ── Search param filters ─────────────────────────────────────────────────

describe('buildTransferFilters — search params', () => {
  it('type param adds type filter', () => {
    const where = buildTransferFilters({ type: 'INVESTOR_DEPOSIT' }, managerCtx)
    expect(where.type).toEqual({ equals: 'INVESTOR_DEPOSIT' })
  })

  it('sourceRegister param adds numeric filter', () => {
    const where = buildTransferFilters({ sourceRegister: '3' }, managerCtx)
    expect(where.sourceRegister).toEqual({ equals: 3 })
  })

  it('investment param adds numeric filter', () => {
    const where = buildTransferFilters({ investment: '10' }, managerCtx)
    expect(where.investment).toEqual({ equals: 10 })
  })

  it('createdBy param adds numeric filter', () => {
    const where = buildTransferFilters({ createdBy: '7' }, managerCtx)
    expect(where.createdBy).toEqual({ equals: 7 })
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
    expect(where.type).toEqual({ equals: 'EMPLOYEE_EXPENSE' })
    expect(where.sourceRegister).toEqual({ equals: 1 })
    expect(where.date).toEqual({ greater_than_equal: '2024-06-01' })
  })
})
