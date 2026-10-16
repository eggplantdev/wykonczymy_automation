import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionUserT } from '@/types/auth'
import type { ReferenceDataBaseT } from '@/types/reference-data'

vi.mock('server-only', () => ({}))

const mockUser: SessionUserT = { id: 1, email: 'admin@test.com', name: 'Admin', role: 'ADMIN' }

const mockRequireAuth = vi.fn().mockResolvedValue({ success: true, user: mockUser })
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

const mockRefData: ReferenceDataBaseT = {
  cashRegisters: [
    { id: 1, name: 'Main Reg', type: 'MAIN', active: true, ownerId: 1 },
    { id: 2, name: 'Aux Reg', type: 'AUXILIARY', active: true, ownerId: 2 },
    { id: 3, name: 'Virtual Reg', type: 'VIRTUAL', active: true, ownerId: 1 },
    { id: 4, name: 'Inactive Virtual', type: 'VIRTUAL', active: false, ownerId: 1 },
    { id: 5, name: 'Worker Reg Emp1', type: 'WORKER', active: true, ownerId: 3 },
    { id: 6, name: 'Worker Reg Emp2', type: 'WORKER', active: true, ownerId: 4 },
  ],
  trashedCashRegisters: [],
  trashedInvestments: [],
  trashedWorkers: [],
  investments: [
    {
      id: 10,
      name: 'Inv A',
      status: 'active' as const,
      active: true,
      address: 'Addr',
      phone: '123',
      email: 'e@e.com',
      contactPerson: 'CP',
      reviewRequested: false,
      hasSheet: false,
      aiStage: null,
      createdAt: '2026-01-15T10:00:00.000Z',
      materialsNetRate: null,
      settlementMode: 'NET' as const,
      vatRate: 0.08,
    },
    {
      id: 20,
      name: 'Inv B',
      status: 'completed' as const,
      active: false,
      address: '',
      phone: '',
      email: '',
      contactPerson: '',
      reviewRequested: false,
      hasSheet: false,
      aiStage: null,
      createdAt: '2026-01-15T10:00:00.000Z',
      materialsNetRate: null,
      settlementMode: 'NET' as const,
      vatRate: 0.08,
    },
  ],
  workers: [
    {
      id: 1,
      name: 'Admin',
      role: 'ADMIN',
      active: true,
      email: 'admin@test.com',
      language: null,
      canAddExpensesWithoutInvestment: false,
    },
    {
      id: 2,
      name: 'Manager',
      role: 'MANAGER',
      active: true,
      email: 'mgr@test.com',
      language: null,
      canAddExpensesWithoutInvestment: false,
    },
    {
      id: 3,
      name: 'Employee One',
      role: 'EMPLOYEE',
      active: true,
      email: 'emp1@test.com',
      language: null,
      canAddExpensesWithoutInvestment: false,
    },
    {
      id: 4,
      name: 'Employee Two',
      role: 'EMPLOYEE',
      active: true,
      email: 'emp2@test.com',
      language: null,
      canAddExpensesWithoutInvestment: false,
    },
  ],
  otherCategories: [],
  expenseCategories: [],
}

vi.mock('@/lib/queries/reference-data', () => ({
  fetchReferenceData: vi.fn().mockResolvedValue(mockRefData),
}))

vi.mock('@/lib/queries/balances', () => ({
  fetchRegisterBalances: vi
    .fn()
    .mockResolvedValue({ '1': 10000, '2': 5000, '3': 3000, '5': 200, '6': -50 }),
}))

const { dashboardFilterOptions } = await import('@/lib/queries/dashboard')
const { fetchVisibleRegisters } = await import('@/lib/queries/cash-registers')

beforeEach(() => {
  mockRequireAuth.mockResolvedValue({ success: true, user: mockUser })
})

describe('fetchVisibleRegisters', () => {
  it('admin sees all registers', async () => {
    const data = await fetchVisibleRegisters()
    expect(data.registers.length).toBe(6)
    expect(data.isAdminOrOwner).toBe(true)
  })

  it('manager cannot see MAIN registers', async () => {
    mockRequireAuth.mockResolvedValue({
      success: true,
      user: { ...mockUser, id: 2, role: 'MANAGER' },
    })
    const data = await fetchVisibleRegisters()
    expect(data.registers.every((cr) => cr.type !== 'MAIN')).toBe(true)
    expect(data.isAdminOrOwner).toBe(false)
  })
})

describe('dashboardFilterOptions', () => {
  it('offers a manager no MAIN register', () => {
    const ids = dashboardFilterOptions(mockRefData, 'MANAGER').cashRegisters.map((cr) => cr.id)
    expect(ids).not.toContain(1)
    expect(dashboardFilterOptions(mockRefData, 'ADMIN').cashRegisters.map((cr) => cr.id)).toContain(
      1,
    )
  })

  it('users contains ADMIN and MANAGER only', () => {
    const { users } = dashboardFilterOptions(mockRefData, 'ADMIN')
    expect(users.map((u) => u.id).sort()).toEqual([1, 2])
  })

  it('only includes active investments', () => {
    const { investments } = dashboardFilterOptions(mockRefData, 'ADMIN')
    expect(investments).toEqual([{ id: 10, name: 'Inv A' }])
  })
})
