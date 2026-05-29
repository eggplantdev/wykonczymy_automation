import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

// after() (next/server) schedules the post-response sheet sync; it throws outside
// a request scope. The sync isn't under test here, so no-op it.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const mockCreate = vi.fn()
const mockBeginTransaction = vi.fn()
const mockCommitTransaction = vi.fn()
const mockRollbackTransaction = vi.fn()

const mockPayload = {
  create: mockCreate,
  db: {
    beginTransaction: mockBeginTransaction,
    commitTransaction: mockCommitTransaction,
    rollbackTransaction: mockRollbackTransaction,
  },
} as unknown as Payload

const mockUser = { id: 1, email: 'a@t.com', name: 'Admin', role: 'ADMIN' as const }

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn().mockResolvedValue(mockPayload),
  }
})

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ success: true, user: mockUser }),
}))

// upload-invoice is no longer called by server actions (uploads happen client-side via API route)

vi.mock('@/lib/cache/revalidate', () => ({
  revalidateCollections: vi.fn(),
}))

vi.mock('@/lib/db/sum-transfers', () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue({
      rows: [{ id: 1, name: 'Main', type: 'MAIN', active: true, owner_id: 1 }],
    }),
  }),
  sumRegisterBalance: vi.fn().mockResolvedValue(99999),
}))

const { createBulkTransferAction } = await import('@/lib/actions/transfers')

// ── Helpers ──────────────────────────────────────────────────────────────

const TX_ID = 'test-tx-id'

function makeBulkTransferData(itemCount: number) {
  return {
    type: 'INVESTMENT_EXPENSE' as const,
    date: '2026-02-25',
    paymentMethod: 'CASH' as const,
    sourceRegister: 1,
    investment: 1,
    lineItems: Array.from({ length: itemCount }, (_, i) => ({
      description: `Item ${i + 1}`,
      amount: 100,
      expenseCategory: 1,
    })),
  }
}

beforeEach(() => {
  mockCreate.mockReset()
  mockBeginTransaction.mockReset().mockResolvedValue(TX_ID)
  mockCommitTransaction.mockReset().mockResolvedValue(undefined)
  mockRollbackTransaction.mockReset().mockResolvedValue(undefined)
})

// ═════════════════════════════════════════════════════════════════════════
// Bulk Transfer — transaction rollback
// ═════════════════════════════════════════════════════════════════════════

describe('createBulkTransferAction — transaction safety', () => {
  it('commits when all items succeed', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    const result = await createBulkTransferAction(makeBulkTransferData(3))

    expect(result.success).toBe(true)
    expect(mockBeginTransaction).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(mockCommitTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockRollbackTransaction).not.toHaveBeenCalled()
  })

  it('rolls back when 3rd of 5 items fails — no partial writes persist', async () => {
    mockCreate
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 })
      .mockRejectedValueOnce(new Error('DB constraint violation'))

    const result = await createBulkTransferAction(makeBulkTransferData(5))

    expect(result.success).toBe(false)
    expect(mockRollbackTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockCommitTransaction).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  it('all creates share the same transaction ID via req', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    await createBulkTransferAction(makeBulkTransferData(4))

    for (const call of mockCreate.mock.calls) {
      expect(call[0]).toHaveProperty('req', {
        transactionID: TX_ID,
        context: { skipSheetSync: true },
      })
    }
  })
})
