import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Where } from 'payload'
import type { RoleT } from '@/lib/auth/roles'

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
  beforeEach(() => {
    fetchAllTransferRows.mockClear()
    session.user.role = 'EMPLOYEE'
  })

  it('stays management-only — it takes a client Where', async () => {
    const result = await fetchFilteredTransfers({})

    expect(result.success).toBe(false)
    expect(fetchAllTransferRows).not.toHaveBeenCalled()
  })

  it('stays management-only with a range too', async () => {
    const result = await fetchFilteredTransfers(
      {},
      { range: { from: '2026-09-01', to: '2026-09-30' } },
    )

    expect(result.success).toBe(false)
    expect(fetchAllTransferRows).not.toHaveBeenCalled()
  })
})

describe('fetchFilteredTransfers — invoice range', () => {
  beforeEach(() => {
    fetchAllTransferRows.mockClear()
    session.user.role = 'MANAGER'
  })

  it('replaces the table window with the range', async () => {
    const tableWhere: Where = {
      investment: { equals: 31 },
      date: { greater_than_equal: '2026-03-01', less_than_equal: '2026-03-31' },
    }

    const result = await fetchFilteredTransfers(tableWhere, {
      range: { from: '2026-09-01', to: '2026-09-30' },
    })

    expect(result.success).toBe(true)
    const sent = JSON.stringify(fetchAllTransferRows.mock.calls[0][0])
    expect(sent).toContain('"greater_than_equal":"2026-09-01"')
    expect(sent).toContain('"less_than_equal":"2026-09-30"')
    expect(sent).not.toContain('2026-03-')
    expect(sent).toContain('"investment":{"equals":31}')
  })

  it.each([
    ['a half range', { from: '2026-09-01', to: '' }],
    ['a malformed bound', { from: '2026-09-01', to: '2026-02-30' }],
    ['a non-ISO bound', { from: '1.09.2026', to: '2026-09-30' }],
    ['an inverted range', { from: '2026-09-30', to: '2026-09-01' }],
  ])('refuses %s without querying', async (_label, range) => {
    const result = await fetchFilteredTransfers({}, { range })

    expect(result.success).toBe(false)
    expect(fetchAllTransferRows).not.toHaveBeenCalled()
  })
})
