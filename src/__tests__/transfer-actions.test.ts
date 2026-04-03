import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockFindByID = vi.fn()
const mockDelete = vi.fn()
const mockBeginTransaction = vi.fn()
const mockCommitTransaction = vi.fn()
const mockRollbackTransaction = vi.fn()

const mockPayload = {
  create: mockCreate,
  update: mockUpdate,
  findByID: mockFindByID,
  delete: mockDelete,
  db: {
    beginTransaction: mockBeginTransaction,
    commitTransaction: mockCommitTransaction,
    rollbackTransaction: mockRollbackTransaction,
  },
} as unknown as Payload

const adminUser = { id: 1, email: 'admin@t.com', name: 'Admin', role: 'ADMIN' as const }
const ownerUser = { id: 2, email: 'owner@t.com', name: 'Owner', role: 'OWNER' as const }
const managerUser = { id: 3, email: 'mgr@t.com', name: 'Manager', role: 'MANAGER' as const }
const otherManagerUser = { id: 4, email: 'mgr2@t.com', name: 'Manager2', role: 'MANAGER' as const }

const mockRequireAuth = vi.fn()

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn().mockResolvedValue(mockPayload),
  }
})

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

// upload-invoice is no longer called by server actions (uploads happen client-side via API route)

vi.mock('@/lib/cache/revalidate', () => ({
  revalidateCollections: vi.fn(),
}))

const mockDbExecute = vi.fn()

vi.mock('@/lib/db/sum-transfers', () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockDbExecute(...args),
  }),
  sumRegisterBalance: vi.fn().mockResolvedValue(99999),
}))

const {
  createTransferAction,
  createBulkTransferAction,
  cancelTransferAction,
  updateTransferAction,
  updateTransferInvoiceAction,
} = await import('@/lib/actions/transfers')

// ── Helpers ──────────────────────────────────────────────────────────────

const TX_ID = 'test-tx-id'

function makeSingleTransferData(overrides = {}) {
  return {
    description: 'Test transfer',
    amount: 500,
    date: '2026-02-25',
    type: 'INVESTMENT_EXPENSE' as const,
    paymentMethod: 'CASH' as const,
    sourceRegister: 1,
    investment: 1,
    expenseCategory: 1,
    ...overrides,
  }
}

function makeDepositData(overrides = {}) {
  return {
    description: 'Deposit',
    amount: 1000,
    date: '2026-02-25',
    type: 'INVESTOR_DEPOSIT' as const,
    paymentMethod: 'CASH' as const,
    sourceRegister: 1,
    investment: 1,
    ...overrides,
  }
}

function makeBulkTransferData(itemCount: number, overrides = {}) {
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
    ...overrides,
  }
}

function makeOriginalTransfer(overrides = {}) {
  return {
    id: 10,
    type: 'INVESTMENT_EXPENSE',
    amount: 500,
    date: '2026-02-20',
    description: 'Original',
    paymentMethod: 'CASH',
    cancelled: false,
    createdBy: 3, // managerUser.id
    ...overrides,
  }
}

function defaultDbRow(overrides = {}) {
  return { id: 1, name: 'Main', type: 'MAIN', active: true, owner_id: 1, ...overrides }
}

beforeEach(() => {
  mockCreate.mockReset().mockResolvedValue({ id: 1 })
  mockUpdate.mockReset().mockResolvedValue({ id: 1 })
  mockFindByID.mockReset()
  mockDelete.mockReset().mockResolvedValue(undefined)
  mockBeginTransaction.mockReset().mockResolvedValue(TX_ID)
  mockCommitTransaction.mockReset().mockResolvedValue(undefined)
  mockRollbackTransaction.mockReset().mockResolvedValue(undefined)
  mockRequireAuth.mockReset().mockResolvedValue({ success: true, user: adminUser })
  mockDbExecute.mockReset().mockResolvedValue({ rows: [defaultDbRow()] })
})

// ═════════════════════════════════════════════════════════════════════════
// createTransferAction
// ═════════════════════════════════════════════════════════════════════════

describe('createTransferAction', () => {
  it('valid INVESTMENT_EXPENSE transfer → success', async () => {
    const result = await createTransferAction(makeSingleTransferData())

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        data: expect.objectContaining({
          amount: 500,
          type: 'INVESTMENT_EXPENSE',
          date: '2026-02-25',
          paymentMethod: 'CASH',
          createdBy: adminUser.id,
        }),
      }),
    )
  })

  it('valid INVESTOR_DEPOSIT → success', async () => {
    const result = await createTransferAction(makeDepositData())

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('valid COMPANY_FUNDING → success', async () => {
    const result = await createTransferAction(makeDepositData({ type: 'COMPANY_FUNDING' }))

    expect(result.success).toBe(true)
  })

  it('valid OTHER_DEPOSIT → success', async () => {
    const result = await createTransferAction(makeDepositData({ type: 'OTHER_DEPOSIT' }))

    expect(result.success).toBe(true)
  })

  it('valid PAYOUT → success', async () => {
    const result = await createTransferAction(
      makeSingleTransferData({ type: 'PAYOUT', investment: undefined }),
    )

    expect(result.success).toBe(true)
  })

  it('type needing source register → calls validateSourceRegister (DB call)', async () => {
    await createTransferAction(makeSingleTransferData())

    expect(mockDbExecute).toHaveBeenCalled()
  })

  it('deposit type with source register → also calls validateSourceRegister', async () => {
    await createTransferAction(makeDepositData())

    expect(mockDbExecute).toHaveBeenCalled()
  })

  it('LABOR_COST → skips validateSourceRegister (no DB call)', async () => {
    await createTransferAction(
      makeSingleTransferData({ type: 'LABOR_COST', sourceRegister: undefined }),
    )

    expect(mockDbExecute).not.toHaveBeenCalled()
  })

  it('missing amount → returns validation error', async () => {
    const result = await createTransferAction(
      makeSingleTransferData({ amount: undefined }) as never,
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeTruthy()
  })

  it('zero amount → returns validation error', async () => {
    const result = await createTransferAction(makeSingleTransferData({ amount: 0 }))

    expect(result.success).toBe(false)
  })

  it('negative amount → returns validation error', async () => {
    const result = await createTransferAction(makeSingleTransferData({ amount: -100 }))

    expect(result.success).toBe(false)
  })

  it('invalid type → returns validation error', async () => {
    const result = await createTransferAction(
      makeSingleTransferData({ type: 'INVALID_TYPE' }) as never,
    )

    expect(result.success).toBe(false)
  })

  it('missing date → returns validation error', async () => {
    const result = await createTransferAction(makeSingleTransferData({ date: '' }))

    expect(result.success).toBe(false)
  })

  it('invoice mediaId → passes mediaId to payload.create', async () => {
    await createTransferAction(makeSingleTransferData(), 42)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invoice: 42 }),
      }),
    )
  })

  it('no invoice → passes undefined as invoice', async () => {
    await createTransferAction(makeSingleTransferData())

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invoice: undefined }),
      }),
    )
  })

  it('payload.create failure → returns error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB write failed'))

    const result = await createTransferAction(makeSingleTransferData())

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('DB write failed')
  })

  it('creates with correct data shape → description, amount, date, type, paymentMethod, createdBy', async () => {
    const data = makeSingleTransferData({
      description: 'Custom description',
      amount: 250.5,
      date: '2026-03-15',
    })

    await createTransferAction(data)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        data: expect.objectContaining({
          description: 'Custom description',
          amount: 250.5,
          date: '2026-03-15',
          type: 'INVESTMENT_EXPENSE',
          paymentMethod: 'CASH',
          createdBy: adminUser.id,
        }),
      }),
    )
  })

  it('empty description defaults to empty string', async () => {
    const data = makeSingleTransferData({ description: undefined })

    await createTransferAction(data)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: '' }),
      }),
    )
  })

  it('source register validation failure → returns error before create', async () => {
    mockDbExecute.mockResolvedValueOnce({ rows: [] })

    const result = await createTransferAction(makeSingleTransferData())

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Kasa nie istnieje')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('manager can transfer from any register regardless of owner', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: managerUser })
    // Register owner_id = 1, managerUser.id = 3
    mockDbExecute.mockResolvedValueOnce({ rows: [defaultDbRow({ owner_id: 1 })] })

    const result = await createTransferAction(makeSingleTransferData())

    expect(result.success).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// createBulkTransferAction
// ═════════════════════════════════════════════════════════════════════════

describe('createBulkTransferAction', () => {
  it('valid bulk with correct data per item → each create has correct item data', async () => {
    const data = makeBulkTransferData(3)
    const result = await createBulkTransferAction(data)

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(3)

    for (let i = 0; i < 3; i++) {
      expect(mockCreate.mock.calls[i][0]).toEqual(
        expect.objectContaining({
          collection: 'transactions',
          data: expect.objectContaining({
            description: `Item ${i + 1}`,
            amount: 100,
            date: '2026-02-25',
            type: 'INVESTMENT_EXPENSE',
            paymentMethod: 'CASH',
            sourceRegister: 1,
            investment: 1,
            createdBy: adminUser.id,
          }),
        }),
      )
    }
  })

  it('schema validation failure — empty lineItems → returns error', async () => {
    const result = await createBulkTransferAction(
      makeBulkTransferData(0, { lineItems: [] }) as never,
    )

    expect(result.success).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('schema validation failure — zero amount in lineItem → returns error', async () => {
    const data = {
      ...makeBulkTransferData(1),
      lineItems: [{ description: 'Bad', amount: 0 }],
    }

    const result = await createBulkTransferAction(data as never)

    expect(result.success).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('source register validation failure → returns error before any creates', async () => {
    mockDbExecute.mockResolvedValueOnce({ rows: [] })

    const result = await createBulkTransferAction(makeBulkTransferData(3))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Kasa nie istnieje')
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockBeginTransaction).not.toHaveBeenCalled()
  })

  it('large batch (40 items) → all 40 creates called sequentially with transaction', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    const result = await createBulkTransferAction(makeBulkTransferData(40))

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(40)
    expect(mockBeginTransaction).toHaveBeenCalledOnce()
    expect(mockCommitTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockRollbackTransaction).not.toHaveBeenCalled()

    // All creates share the same transaction ID
    for (const call of mockCreate.mock.calls) {
      expect(call[0]).toHaveProperty('req', { transactionID: TX_ID })
    }
  })

  it('each create gets correct invoice mediaId from array', async () => {
    const mediaIds = [101, undefined, 103]

    await createBulkTransferAction(makeBulkTransferData(3), mediaIds)

    expect(mockCreate.mock.calls[0][0].data.invoice).toBe(101)
    expect(mockCreate.mock.calls[1][0].data.invoice).toBeUndefined()
    expect(mockCreate.mock.calls[2][0].data.invoice).toBe(103)
  })

  it('OTHER type → each create gets its own category from line item', async () => {
    const data = {
      type: 'OTHER' as const,
      date: '2026-02-25',
      paymentMethod: 'CASH' as const,
      sourceRegister: 1,
      lineItems: [
        { description: 'Item 1', amount: 100, category: 5 },
        { description: 'Item 2', amount: 200, category: 7 },
      ],
    }

    const result = await createBulkTransferAction(data)

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(mockCreate.mock.calls[0][0].data).toEqual(expect.objectContaining({ otherCategory: 5 }))
    expect(mockCreate.mock.calls[1][0].data).toEqual(expect.objectContaining({ otherCategory: 7 }))
  })

  it('INVESTMENT_EXPENSE with optional per-line category → passes through', async () => {
    const data = {
      ...makeBulkTransferData(1),
      lineItems: [{ description: 'Item', amount: 100, category: 3, expenseCategory: 1 }],
    }

    const result = await createBulkTransferAction(data)

    expect(result.success).toBe(true)
    expect(mockCreate.mock.calls[0][0].data).toEqual(expect.objectContaining({ otherCategory: 3 }))
  })

  it('transaction rollback when create fails mid-batch', async () => {
    mockCreate
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error('Constraint violation'))

    const result = await createBulkTransferAction(makeBulkTransferData(3))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Constraint violation')
    expect(mockRollbackTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockCommitTransaction).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// cancelTransferAction
// ═════════════════════════════════════════════════════════════════════════

describe('cancelTransferAction', () => {
  it('success → marks original cancelled + creates CANCELLATION audit row', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))

    const result = await cancelTransferAction(10)

    expect(result.success).toBe(true)

    // Marks original as cancelled
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        id: 10,
        data: { cancelled: true },
      }),
    )

    // Creates CANCELLATION audit row
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        data: expect.objectContaining({
          type: 'CANCELLATION',
          amount: 500,
          cancelledTransaction: 10,
          createdBy: adminUser.id,
        }),
      }),
    )
  })

  it('transfer not found → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(null)

    const result = await cancelTransferAction(999)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Transakcja nie istnieje.')
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('already cancelled → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ cancelled: true }))

    const result = await cancelTransferAction(10)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Transakcja jest już anulowana.')
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('permission: creator (MANAGER) can cancel own transfer', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: managerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await cancelTransferAction(10)

    expect(result.success).toBe(true)
  })

  it('permission: ADMIN can cancel any transfer', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: adminUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await cancelTransferAction(10)

    expect(result.success).toBe(true)
  })

  it('permission: OWNER can cancel any transfer', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: ownerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await cancelTransferAction(10)

    expect(result.success).toBe(true)
  })

  it('permission: MANAGER who did not create → cannot cancel', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: otherManagerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await cancelTransferAction(10)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Nie masz uprawnień do anulowania tej transakcji.')
    }
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('CANCELLATION audit row has correct data → amount, date, cancelledTransaction reference', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ createdBy: adminUser.id, amount: 777, paymentMethod: 'CASH' }),
    )

    await cancelTransferAction(10)

    const today = new Date().toISOString().split('T')[0]
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        data: expect.objectContaining({
          type: 'CANCELLATION',
          amount: 777,
          date: today,
          description: 'Anulowanie transakcji #10',
          paymentMethod: 'CASH',
          cancelledTransaction: 10,
          createdBy: adminUser.id,
        }),
      }),
    )
  })

  it('createdBy as object (populated relation) → extracts id correctly', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ createdBy: { id: managerUser.id, name: 'Manager' } }),
    )
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: managerUser })

    const result = await cancelTransferAction(10)

    expect(result.success).toBe(true)
  })

  it('payload.update failure → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))
    mockUpdate.mockRejectedValueOnce(new Error('Update failed'))

    const result = await cancelTransferAction(10)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Update failed')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('payload.create failure (audit row) → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))
    mockUpdate.mockResolvedValueOnce({ id: 10 })
    mockCreate.mockRejectedValueOnce(new Error('Audit row creation failed'))

    const result = await cancelTransferAction(10)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Audit row creation failed')
  })

  it('findByID called with correct collection and depth 0', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))

    await cancelTransferAction(10)

    expect(mockFindByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        id: 10,
        depth: 0,
      }),
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════
// updateTransferAction
// ═════════════════════════════════════════════════════════════════════════

function makeUpdateData(overrides = {}) {
  return {
    description: 'Updated description',
    date: '2026-03-01',
    paymentMethod: 'CASH' as const,
    investment: 1,
    expenseCategory: 1,
    invoiceNote: 'Updated note',
    ...overrides,
  }
}

describe('updateTransferAction', () => {
  it('success → updates transaction with editable fields + updatedBy', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        id: 10,
        data: expect.objectContaining({
          description: 'Updated description',
          date: '2026-03-01',
          paymentMethod: 'CASH',
          updatedBy: adminUser.id,
        }),
      }),
    )
  })

  it('cancelled transaction → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ cancelled: true }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Transakcja jest już anulowana.')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('CANCELLATION type → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ type: 'CANCELLATION', createdBy: adminUser.id }),
    )

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Nie można edytować anulowania.')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('transaction not found → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(null)

    const result = await updateTransferAction(999, makeUpdateData())

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Transakcja nie istnieje.')
  })

  it('permission: MANAGER can edit own transaction', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: managerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(true)
  })

  it('permission: MANAGER cannot edit another users transaction', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: otherManagerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Nie masz uprawnień do edycji tej transakcji.')
    }
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('permission: ADMIN can edit any transaction', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: adminUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(true)
  })

  it('permission: OWNER can edit any transaction', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: ownerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(true)
  })

  it('createdBy as populated object → extracts id correctly', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ createdBy: { id: managerUser.id, name: 'Manager' } }),
    )
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: managerUser })

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(true)
  })

  it('payload.update failure → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))
    mockUpdate.mockRejectedValueOnce(new Error('Update failed'))

    const result = await updateTransferAction(10, makeUpdateData())

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Update failed')
  })

  it('passes all edited fields to payload.update', async () => {
    const original = makeOriginalTransfer({
      createdBy: adminUser.id,
      sourceRegister: 5,
      investment: 2,
      type: 'INVESTMENT_EXPENSE',
    })
    mockFindByID.mockResolvedValueOnce(original)

    await updateTransferAction(10, makeUpdateData({ investment: 3 }))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          investment: 3,
          updatedBy: adminUser.id,
        }),
      }),
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════
// updateTransferInvoiceAction
// ═════════════════════════════════════════════════════════════════════════

describe('updateTransferInvoiceAction', () => {
  beforeEach(() => {
    mockFindByID.mockResolvedValue({ invoice: 42 })
  })

  it('success → updates invoice reference with mediaId', async () => {
    const result = await updateTransferInvoiceAction(10, 88)

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        id: 10,
        data: { invoice: 88 },
      }),
    )
  })

  it('deletes old media when replacing invoice', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: 55 })

    await updateTransferInvoiceAction(10, 88)

    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 55 }),
    )
  })

  it('skips old media deletion when no previous invoice', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: null })

    await updateTransferInvoiceAction(10, 88)

    expect(mockDelete).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'media' }))
  })

  it('called with correct collection and mediaId', async () => {
    await updateTransferInvoiceAction(77, 200)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        id: 77,
        data: { invoice: 200 },
      }),
    )
  })

  it('payload.update failure → returns error', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Invoice update failed'))

    const result = await updateTransferInvoiceAction(10, 88)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invoice update failed')
  })
})
