import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SessionUserT } from '@/types/auth'
import type { ReferenceDataBaseT } from '@/types/reference-data'

// ── Mocks ────────────────────────────────────────────────────────────────

// server-only throws at import time outside Next.js — stub it out
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
      notes: '',
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
      notes: '',
    },
  ],
  workers: [
    { id: 1, name: 'Admin', type: 'ADMIN', active: true, email: 'admin@test.com' },
    { id: 2, name: 'Manager', type: 'MANAGER', active: true, email: 'mgr@test.com' },
    { id: 3, name: 'Employee One', type: 'EMPLOYEE', active: true, email: 'emp1@test.com' },
    { id: 4, name: 'Employee Two', type: 'EMPLOYEE', active: true, email: 'emp2@test.com' },
  ],
  otherCategories: [],
  expenseCategories: [],
}

vi.mock('@/lib/queries/reference-data', () => ({
  fetchReferenceData: vi.fn().mockResolvedValue(mockRefData),
  fetchRegisterBalances: vi
    .fn()
    .mockResolvedValue({ '1': 10000, '2': 5000, '3': 3000, '5': 200, '6': -50 }),
  fetchInvestmentFinancials: vi.fn().mockResolvedValue({
    '10': {
      categoryCosts: [],
      totalMaterialCosts: 2000,
      totalIncome: 8000,
      totalLaborCosts: 500,
      totalPayouts: 300,
    },
  }),
}))

const { fetchManagerDashboardData } = await import('@/lib/queries/dashboard')

beforeEach(() => {
  mockRequireAuth.mockResolvedValue({ success: true, user: mockUser })
})

// ── Tests ────────────────────────────────────────────────────────────────

describe('fetchManagerDashboardData', () => {
  it('returns all expected fields', async () => {
    const data = await fetchManagerDashboardData()
    expect(data).toHaveProperty('visibleRegisters')
    expect(data).toHaveProperty('allInvestments')
    expect(data).toHaveProperty('activeInvestments')
    expect(data).toHaveProperty('managementUsers')
    expect(data).toHaveProperty('totalBalance')
    expect(data).toHaveProperty('ownedBalance')
    expect(data).toHaveProperty('virtualRegisters')
    expect(data).toHaveProperty('isAdminOrOwner')
    expect(data).toHaveProperty('currentUserId')
  })

  describe('investment balance calculation', () => {
    it('calculates balance, totalCosts, and margin correctly', async () => {
      const data = await fetchManagerDashboardData()
      const invA = data.allInvestments.find((i) => i.id === 10)!
      // balance: 8000 - 2000 - 500 = 5500
      expect(invA.balance).toBe(5500)
      // totalCosts: 2000 + 500 = 2500
      expect(invA.totalCosts).toBe(2500)
      // totalPayouts: 300
      expect(invA.totalPayouts).toBe(300)
      // margin: laborCosts - payouts = 500 - 300 = 200
      expect(invA.margin).toBe(200)
    })

    it('defaults missing financials to 0', async () => {
      const data = await fetchManagerDashboardData()
      const invB = data.allInvestments.find((i) => i.id === 20)!
      expect(invB.balance).toBe(0)
      expect(invB.totalCosts).toBe(0)
      expect(invB.totalPayouts).toBe(0)
      expect(invB.margin).toBe(0)
    })
  })

  describe('admin/owner view', () => {
    it('admin sees all registers', async () => {
      const data = await fetchManagerDashboardData()
      expect(data.visibleRegisters.length).toBe(6)
      expect(data.isAdminOrOwner).toBe(true)
    })

    it('totalBalance excludes VIRTUAL registers', async () => {
      const data = await fetchManagerDashboardData()
      // Main(10000) + Aux(5000) + Worker1(200) + Worker2(-50) = 15150 (virtual excluded)
      expect(data.totalBalance).toBe(15150)
    })

    it('ownedBalance filters by ownerId and excludes VIRTUAL', async () => {
      const data = await fetchManagerDashboardData()
      // User 1 owns: Main(10000, non-virtual) + Virtual(3000, excluded) + InactiveVirtual(0, excluded)
      expect(data.ownedBalance).toBe(10000)
    })
  })

  describe('manager view', () => {
    it('manager cannot see MAIN registers', async () => {
      mockRequireAuth.mockResolvedValue({
        success: true,
        user: { ...mockUser, id: 2, role: 'MANAGER' },
      })
      const data = await fetchManagerDashboardData()
      expect(data.visibleRegisters.every((cr) => cr.type !== 'MAIN')).toBe(true)
      expect(data.isAdminOrOwner).toBe(false)
    })
  })

  describe('user filtering', () => {
    it('managementUsers contains ADMIN and MANAGER', async () => {
      const data = await fetchManagerDashboardData()
      expect(data.managementUsers.length).toBe(2)
      expect(data.managementUsers.map((u) => u.id)).toEqual(expect.arrayContaining([1, 2]))
    })
  })

  describe('virtual registers', () => {
    it('virtualRegisters filtered to VIRTUAL + active only', async () => {
      const data = await fetchManagerDashboardData()
      expect(data.virtualRegisters.length).toBe(1)
      expect(data.virtualRegisters[0].name).toBe('Virtual Reg')
    })
  })

  describe('activeInvestments', () => {
    it('only includes active investments', async () => {
      const data = await fetchManagerDashboardData()
      expect(data.activeInvestments.length).toBe(1)
      expect(data.activeInvestments[0].name).toBe('Inv A')
    })
  })
})
