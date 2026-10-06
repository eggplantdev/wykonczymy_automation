import { describe, it, expect, vi } from 'vitest'
import type { Where } from 'payload'
import type { RoleT } from '@/lib/auth/roles'

// Risk #22: Faktury / Drukuj take a client `Where`, so an EMPLOYEE must never reach them.
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

const { fetchFilteredTransfers } = await import('@/lib/queries/fetch-transfers-for-invoices')

describe('fetchFilteredTransfers', () => {
  it('stays management-only — it takes a client Where', async () => {
    const result = await fetchFilteredTransfers({})

    expect(result.success).toBe(false)
    expect(fetchAllTransferRows).not.toHaveBeenCalled()
  })
})
