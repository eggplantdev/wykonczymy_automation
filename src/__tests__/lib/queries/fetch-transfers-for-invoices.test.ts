import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Where } from 'payload'
import type { RoleT } from '@/lib/auth/roles'

// Risk #22: Faktury / Drukuj on the worker page is a client-callable channel open to an EMPLOYEE, so
// the scope must be rebuilt here from the session — whatever the URL params say.
vi.mock('server-only', () => ({}))

const session = vi.hoisted(() => ({ user: { id: 25, role: 'EMPLOYEE' as RoleT } }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async (allowedRoles: readonly RoleT[]) =>
    allowedRoles.includes(session.user.role)
      ? { success: true, user: { ...session.user, email: 'w@example.test', name: 'Pracownik' } }
      : { success: false, error: 'Brak uprawnień' },
  ),
}))

const fetchAllTransferRows = vi.fn(async (_where: Where, _opts: unknown) => [])
vi.mock('@/lib/queries/fetch-transfer-rows', () => ({
  fetchAllTransferRows: (where: Where, opts: unknown) => fetchAllTransferRows(where, opts),
}))

vi.mock('@/lib/queries/reference-data', () => ({
  fetchReferenceData: async () => ({
    cashRegisters: [
      { id: 37, name: 'Kasa pracownika', type: 'WORKER', ownerId: 25, active: true },
      { id: 99, name: 'Kasa innego', type: 'WORKER', ownerId: 7, active: true },
    ],
  }),
}))

const { fetchWorkerTransfers, fetchFilteredTransfers } =
  await import('@/lib/queries/fetch-transfers-for-invoices')

const SCOPE: Where = {
  or: [
    { worker: { equals: 25 } },
    { sourceRegister: { in: [37] } },
    { targetRegister: { in: [37] } },
  ],
}

// The action wraps the scoped Where as the first branch of its own `and`.
function fetchedWhere(): Where {
  const [where] = fetchAllTransferRows.mock.calls[0]!
  return (where.and as Where[])[0]!
}

describe('fetchWorkerTransfers', () => {
  beforeEach(() => {
    fetchAllTransferRows.mockClear()
    session.user = { id: 25, role: 'EMPLOYEE' }
  })

  it("refuses an EMPLOYEE asking for another worker's transfers, without reading any", async () => {
    const result = await fetchWorkerTransfers(7, {})

    expect(result.success).toBe(false)
    expect(fetchAllTransferRows).not.toHaveBeenCalled()
  })

  it('scopes his own fetch to his wypłaty and his kasy', async () => {
    const result = await fetchWorkerTransfers(25, {})

    expect(result.success).toBe(true)
    expect(fetchedWhere().and).toEqual([SCOPE])
  })

  it('keeps the scope when the params name a foreign kasa', async () => {
    await fetchWorkerTransfers(25, { sourceRegister: '99' })

    const where = fetchedWhere()
    expect(where.and).toEqual([SCOPE])
    expect(where.or).toEqual([{ sourceRegister: { in: [99] } }, { targetRegister: { in: [99] } }])
  })

  it("accepts management on any worker's page", async () => {
    session.user = { id: 1, role: 'MANAGER' }

    const result = await fetchWorkerTransfers(25, {})

    expect(result.success).toBe(true)
    expect(fetchedWhere().and).toEqual([SCOPE])
  })
})

describe('fetchFilteredTransfers', () => {
  it('stays management-only — it takes a client Where', async () => {
    fetchAllTransferRows.mockClear()
    session.user = { id: 25, role: 'EMPLOYEE' }

    const result = await fetchFilteredTransfers({})

    expect(result.success).toBe(false)
    expect(fetchAllTransferRows).not.toHaveBeenCalled()
  })
})
