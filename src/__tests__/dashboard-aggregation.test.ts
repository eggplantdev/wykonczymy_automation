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
  ],
  investments: [
    {
      id: 10,
      name: 'Inv A',
      status: 'active' as const,
      active: true,
      laborCosts: 500,
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
      laborCosts: 100,
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
}

vi.mock('@/lib/queries/reference-data', () => ({
  fetchReferenceData: vi.fn().mockResolvedValue(mockRefData),
  fetchWorkerSaldos: vi.fn().mockResolvedValue({ '3': 200, '4': -50 }),
  fetchRegisterBalances: vi.fn().mockResolvedValue({ '1': 10000, '2': 5000, '3': 3000 }),
  fetchInvestmentFinancials: vi.fn().mockResolvedValue({
    '10': { totalCosts: 2000, totalIncome: 8000 },
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
    expect(data).toHaveProperty('users')
    expect(data).toHaveProperty('managementUsers')
    expect(data).toHaveProperty('totalBalance')
    expect(data).toHaveProperty('ownedBalance')
    expect(data).toHaveProperty('virtualRegisters')
    expect(data).toHaveProperty('isAdminOrOwner')
    expect(data).toHaveProperty('currentUserId')
  })

  describe('investment balance calculation', () => {
    it('calculates balance = totalIncome - totalCosts - laborCosts', async () => {
      const data = await fetchManagerDashboardData()
      const invA = data.allInvestments.find((i) => i.id === 10)!
      // 8000 - 2000 - 500 = 5500
      expect(invA.balance).toBe(5500)
    })

    it('defaults missing financials to 0', async () => {
      const data = await fetchManagerDashboardData()
      const invB = data.allInvestments.find((i) => i.id === 20)!
      // 0 - 0 - 100 = -100
      expect(invB.balance).toBe(-100)
    })
  })

  describe('admin/owner view', () => {
    it('admin sees all registers', async () => {
      const data = await fetchManagerDashboardData()
      expect(data.visibleRegisters.length).toBe(4)
      expect(data.isAdminOrOwner).toBe(true)
    })

    it('totalBalance excludes VIRTUAL registers', async () => {
      const data = await fetchManagerDashboardData()
      // Main(10000) + Aux(5000) = 15000 (virtual excluded)
      expect(data.totalBalance).toBe(15000)
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
    it('users list contains only EMPLOYEEs', async () => {
      const data = await fetchManagerDashboardData()
      expect(data.users.every((u) => u.role === 'EMPLOYEE')).toBe(true)
      expect(data.users.length).toBe(2)
    })

    it('assigns saldo from saldoRecord, defaults to 0', async () => {
      const data = await fetchManagerDashboardData()
      const emp1 = data.users.find((u) => u.id === 3)!
      const emp2 = data.users.find((u) => u.id === 4)!
      expect(emp1.saldo).toBe(200)
      expect(emp2.saldo).toBe(-50)
    })

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
