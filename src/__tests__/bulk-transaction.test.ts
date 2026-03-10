import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

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

vi.mock('@/lib/upload-invoice', () => ({
  uploadBulkInvoices: vi
    .fn()
    .mockResolvedValue([undefined, undefined, undefined, undefined, undefined]),
  uploadSingleInvoice: vi.fn().mockResolvedValue(undefined),
}))

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

const { createSettlementAction } = await import('@/lib/actions/settlements')
const { createBulkTransferAction } = await import('@/lib/actions/transfers')

// ── Helpers ──────────────────────────────────────────────────────────────

const TX_ID = 'test-tx-id'

function makeSettlementData(itemCount: number) {
  return {
    workerRegister: 1,
    mode: 'investment' as const,
    investment: 1,
    expenseCategory: 1,
    date: '2026-02-25',
    paymentMethod: 'CASH' as const,
    invoiceNote: '',
    lineItems: Array.from({ length: itemCount }, (_, i) => ({
      description: `Item ${i + 1}`,
      amount: 100,
    })),
  }
}

function makeBulkTransferData(itemCount: number) {
  return {
    type: 'INVESTMENT_EXPENSE' as const,
    date: '2026-02-25',
    paymentMethod: 'CASH' as const,
    sourceRegister: 1,
    investment: 1,
    expenseCategory: 1,
    lineItems: Array.from({ length: itemCount }, (_, i) => ({
      description: `Item ${i + 1}`,
      amount: 100,
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
// Settlement — transaction rollback
// ═════════════════════════════════════════════════════════════════════════

describe('createSettlementAction — transaction safety', () => {
  it('commits when all items succeed', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    const result = await createSettlementAction(makeSettlementData(3), null)

    expect(result.success).toBe(true)
    expect(mockBeginTransaction).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(mockCommitTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockRollbackTransaction).not.toHaveBeenCalled()
  })

  it('rolls back when 3rd of 5 items fails — no partial writes persist', async () => {
    mockCreate
      .mockResolvedValueOnce({ id: 1 }) // item 1 OK
      .mockResolvedValueOnce({ id: 2 }) // item 2 OK
      .mockRejectedValueOnce(new Error('DB constraint violation')) // item 3 FAIL

    const result = await createSettlementAction(makeSettlementData(5), null)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('DB constraint violation')
    }

    // Transaction rolled back — items 1 & 2 would not persist
    expect(mockRollbackTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockCommitTransaction).not.toHaveBeenCalled()

    // Only 3 create calls were attempted (stopped at failure)
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  it('rolls back when 1st item fails — zero writes persist', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Connection lost'))

    const result = await createSettlementAction(makeSettlementData(3), null)

    expect(result.success).toBe(false)
    expect(mockRollbackTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockCommitTransaction).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('all creates share the same transaction ID via req', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    await createSettlementAction(makeSettlementData(3), null)

    for (const call of mockCreate.mock.calls) {
      expect(call[0]).toHaveProperty('req', { transactionID: TX_ID })
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════
// Bulk Transfer — transaction rollback
// ═════════════════════════════════════════════════════════════════════════

describe('createBulkTransferAction — transaction safety', () => {
  it('commits when all items succeed', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    const result = await createBulkTransferAction(makeBulkTransferData(3), null)

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

    const result = await createBulkTransferAction(makeBulkTransferData(5), null)

    expect(result.success).toBe(false)
    expect(mockRollbackTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockCommitTransaction).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  it('all creates share the same transaction ID via req', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    await createBulkTransferAction(makeBulkTransferData(4), null)

    for (const call of mockCreate.mock.calls) {
      expect(call[0]).toHaveProperty('req', { transactionID: TX_ID })
    }
  })
})
