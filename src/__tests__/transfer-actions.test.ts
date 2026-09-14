import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

// The actions schedule the post-response Google Sheets sync via next/server's
// after(). Outside a request scope (i.e. in these unit tests) the real after()
// throws. Run the callback synchronously so the scheduled sheet work is observable.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (fn: () => unknown) => fn() }
})

// The sheet sync itself isn't under test here — spy on the boundary functions.
const mockSyncSingle = vi.fn()
const mockSyncBulk = vi.fn()
const mockRemoveFromSheet = vi.fn()
vi.mock('@/lib/actions/sheets-sync', () => ({
  syncSingleTransferToSheet: (...a: unknown[]) => mockSyncSingle(...a),
  syncBulkExpensesToSheet: (...a: unknown[]) => mockSyncBulk(...a),
  removeTransferFromSheet: (...a: unknown[]) => mockRemoveFromSheet(...a),
}))

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockFindByID = vi.fn()
const mockDelete = vi.fn()
const mockCount = vi.fn()
const mockBeginTransaction = vi.fn()
const mockCommitTransaction = vi.fn()
const mockRollbackTransaction = vi.fn()

const mockPayload = {
  create: mockCreate,
  update: mockUpdate,
  findByID: mockFindByID,
  delete: mockDelete,
  count: mockCount,
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

const VALID_CANCEL_REASON = 'Test reason at least ten chars'

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
// The SQL text of every statement the action layer ran, for tests that care WHICH query fired.
const queriedTables = (): string =>
  mockDbExecute.mock.calls
    .map(
      ([query]) =>
        (query as { queryChunks?: { value?: string[] }[] })?.queryChunks
          ?.map((chunk) => chunk?.value?.join('') ?? '')
          .join('') ?? '',
    )
    .join(' ')

vi.mock('@/lib/db/get-db', () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockDbExecute(...args),
  }),
}))
vi.mock('@/lib/db/sum-transfers', () => ({
  sumRegisterBalance: vi.fn().mockResolvedValue(99999),
}))

const {
  createTransferAction,
  createBulkTransferAction,
  cancelTransferAction,
  updateTransferAction,
  addTransferInvoicesAction,
  removeTransferInvoiceAction,
  removeAllTransferInvoicesAction,
} = await import('@/lib/actions/transfers')

const { deleteOrphanedMediaAction } = await import('@/lib/actions/delete-orphaned-media')

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
    vatPlane: 'NET' as const,
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
  // Default: nothing else points at the media, so the guarded delete goes through.
  mockCount.mockReset().mockResolvedValue({ totalDocs: 0 })
  mockBeginTransaction.mockReset().mockResolvedValue(TX_ID)
  mockCommitTransaction.mockReset().mockResolvedValue(undefined)
  mockRollbackTransaction.mockReset().mockResolvedValue(undefined)
  mockRequireAuth.mockReset().mockResolvedValue({ success: true, user: adminUser })
  mockDbExecute.mockReset().mockResolvedValue({ rows: [defaultDbRow()] })
  mockSyncSingle.mockReset()
  mockSyncBulk.mockReset()
  mockRemoveFromSheet.mockReset()
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

  // Both company deposits are investment-free by rule (EX-557), so their fixtures must be too —
  // and `success` alone cannot tell "the row landed as asked" from "the row landed wrong", since
  // payload.create is mocked and the hook that would clear a stray investment never runs here.
  // The hook's own guard is src/__tests__/hooks/transfers/investment-write-guard.test.ts.
  it.each(['COMPANY_FUNDING', 'OTHER_DEPOSIT'])(
    'valid %s → success, and the created row carries no investment',
    async (type) => {
      const result = await createTransferAction(
        makeDepositData({ type, investment: undefined, vatPlane: undefined }),
      )

      expect(result.success).toBe(true)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'transactions',
          data: expect.objectContaining({ type, investment: undefined, vatPlane: undefined }),
        }),
      )
    },
  )

  // The write takes `parsed.data`, so anything the schema does not name is gone before Payload sees
  // it. Spreading the raw input instead handed a client every column on the row — `cancelled` among
  // them, which is the audit trail.
  it('writes only what the schema named — a smuggled column never reaches payload.create', async () => {
    const result = await createTransferAction({
      ...makeSingleTransferData(),
      cancelled: true,
      settled: true,
    } as unknown as Parameters<typeof createTransferAction>[0])

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ cancelled: expect.anything() }),
      }),
    )
  })

  it('valid PAYOUT → success', async () => {
    const result = await createTransferAction(
      makeSingleTransferData({ type: 'PAYOUT', investment: undefined, worker: 1 }),
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

  it('LABOR_COST → skips validateSourceRegister (no register lookup)', async () => {
    await createTransferAction(
      makeSingleTransferData({ type: 'LABOR_COST', sourceRegister: undefined }),
    )

    // Named on the statement rather than on „no DB call at all": the completed-investment gate
    // queries too, and it is not what this test is about.
    expect(queriedTables()).not.toContain('cash_registers')
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

  it('invoice page list → passes it straight to payload.create', async () => {
    await createTransferAction(makeSingleTransferData(), [42, 43])

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invoice: [42, 43] }),
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

    // All creates share the same transaction ID (+ skip the per-row sheet sync; the
    // action batches it once after commit).
    for (const call of mockCreate.mock.calls) {
      expect(call[0]).toHaveProperty('req', {
        transactionID: TX_ID,
        context: { skipSheetSync: true },
      })
    }
  })

  it('each create gets its own row’s invoice pages, and a page-less row gets none', async () => {
    const mediaIds = [[101, 102], [], [103]]

    await createBulkTransferAction(makeBulkTransferData(3), mediaIds)

    expect(mockCreate.mock.calls[0][0].data.invoice).toEqual([101, 102])
    expect(mockCreate.mock.calls[1][0].data.invoice).toBeUndefined()
    expect(mockCreate.mock.calls[2][0].data.invoice).toEqual([103])
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

    const result = await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

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

    const result = await cancelTransferAction(999, { reason: VALID_CANCEL_REASON })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Transakcja nie istnieje.')
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('already cancelled → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ cancelled: true }))

    const result = await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Transakcja jest już anulowana.')
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('permission: creator (MANAGER) can cancel own transfer', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: managerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

    expect(result.success).toBe(true)
  })

  it('permission: ADMIN can cancel any transfer', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: adminUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

    expect(result.success).toBe(true)
  })

  it('permission: OWNER can cancel any transfer', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: ownerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

    expect(result.success).toBe(true)
  })

  it('permission: MANAGER who did not create → cannot cancel', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: otherManagerUser })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: managerUser.id }))

    const result = await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

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

    await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

    const today = new Date().toISOString().split('T')[0]
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        data: expect.objectContaining({
          type: 'CANCELLATION',
          amount: 777,
          date: today,
          description: `Anulowanie transakcji #10\n${VALID_CANCEL_REASON}`,
          cancelledTransaction: 10,
          createdBy: adminUser.id,
        }),
      }),
    )
    // The original's method is NOT copied: an anulowanie was never asked how it was paid, and a
    // borrowed „Gotówka" would answer for it in the column and the filter.
    expect(mockCreate.mock.calls[0][0].data).not.toHaveProperty('paymentMethod')
  })

  it('createdBy as object (populated relation) → extracts id correctly', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ createdBy: { id: managerUser.id, name: 'Manager' } }),
    )
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: managerUser })

    const result = await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

    expect(result.success).toBe(true)
  })

  it('payload.update failure → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))
    mockUpdate.mockRejectedValueOnce(new Error('Update failed'))

    const result = await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Update failed')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('payload.create failure (audit row) → returns error', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))
    mockUpdate.mockResolvedValueOnce({ id: 10 })
    mockCreate.mockRejectedValueOnce(new Error('Audit row creation failed'))

    const result = await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Audit row creation failed')
  })

  it('findByID called with correct collection and depth 0', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))

    await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

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

  // Not even on the type that owns the plane. It decides which side of the settlement the wpłata
  // pays, so an edit would rewrite a bilans the client has already seen — the correction is a
  // cancellation plus a fresh booking, exactly as for `amount`.
  it.each(['INVESTOR_DEPOSIT', 'INVESTMENT_EXPENSE'])(
    '%s → a vatPlane submitted with an edit never reaches the write',
    async (type) => {
      mockFindByID.mockResolvedValueOnce(
        makeOriginalTransfer({ type, vatPlane: 'NET', createdBy: adminUser.id }),
      )

      const result = await updateTransferAction(10, makeUpdateData({ vatPlane: 'GROSS' }))

      expect(result.success).toBe(true)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ vatPlane: expect.anything() }),
        }),
      )
    },
  )

  // The other half of the same rule: a wpłata booked before the plane existed is missing the figure,
  // not carrying a wrong one, so the fill-in is the only route there will ever be to supply it.
  it('a legacy wpłata with no plane takes the one the edit names', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ type: 'INVESTOR_DEPOSIT', vatPlane: null, createdBy: adminUser.id }),
    )

    const result = await updateTransferAction(
      10,
      makeUpdateData({ vatPlane: 'GROSS', netAmount: 400 }),
    )

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vatPlane: 'GROSS', netAmount: 400 }),
      }),
    )
  })

  // Gotówka IS the netto — no second kwota to type, and the hook nulls the column for that plane.
  it('a legacy wpłata filled in as gotówka takes the plane with no netto', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ type: 'INVESTOR_DEPOSIT', vatPlane: null, createdBy: adminUser.id }),
    )

    const result = await updateTransferAction(10, makeUpdateData({ vatPlane: 'NET' }))

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vatPlane: 'NET', netAmount: null }),
      }),
    )
  })

  it.each([
    ['no netto at all', undefined, 'Kwota netto jest wymagana'],
    ['a netto above the brutto', 900, 'Kwota netto nie może przekraczać kwoty brutto'],
  ])('refuses a brutto fill-in with %s', async (_label, netAmount, error) => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ type: 'INVESTOR_DEPOSIT', vatPlane: null, createdBy: adminUser.id }),
    )

    const result = await updateTransferAction(10, makeUpdateData({ vatPlane: 'GROSS', netAmount }))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe(error)
    expect(mockUpdate).not.toHaveBeenCalled()
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

  it('newly uploaded pages append to the ones already attached', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ createdBy: adminUser.id, invoice: [55, 56] }),
    )

    await updateTransferAction(10, makeUpdateData(), [88, 89])

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invoice: [55, 56, 88, 89] }),
      }),
    )
  })

  it('no uploaded pages → leaves the invoice field untouched', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ createdBy: adminUser.id, invoice: [55] }),
    )

    await updateTransferAction(10, makeUpdateData())

    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty('invoice')
  })

  // Sheet sync moved to the transactions collection afterChange hook (review T2.2),
  // so updateTransferAction no longer calls it directly. The edit / investment-move /
  // non-expense-skip behavior is covered in hooks/sync-kosztorys-sheet.test.ts.
  it('does not sync the sheet directly from the action (hook owns it now)', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ createdBy: adminUser.id, investment: 2 }),
    )

    await updateTransferAction(10, makeUpdateData({ investment: 9 }))

    expect(mockSyncSingle).not.toHaveBeenCalled()
    expect(mockRemoveFromSheet).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// Invoice page actions
// ═════════════════════════════════════════════════════════════════════════

describe('addTransferInvoicesAction', () => {
  it('appends the new page to the pages already attached', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55, 56] })

    const result = await addTransferInvoicesAction(10, [88])

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        id: 10,
        data: { invoice: [55, 56, 88] },
      }),
    )
  })

  // The whole reason the action takes a batch: setTransferInvoices is a read-modify-write, so a
  // page-at-a-time caller would race and keep only the last one.
  it('a whole batch lands in pick order in ONE update', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55] })

    await addTransferInvoicesAction(10, [88, 89, 90])

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { invoice: [55, 88, 89, 90] } }),
    )
  })

  it('appending keeps every existing page — nothing is deleted', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55] })

    await addTransferInvoicesAction(10, [88])

    expect(mockDelete).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'media' }))
  })

  it('reads ids out of populated media docs, not just raw ids', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [{ id: 55, filename: 'p1.jpg' }] })

    await addTransferInvoicesAction(10, [88])

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { invoice: [55, 88] } }),
    )
  })

  it('re-adding an attached page is a no-op rather than a duplicate', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [88] })

    await addTransferInvoicesAction(10, [88])

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { invoice: [88] } }))
  })

  it('a batch mixing attached and new ids appends only the new ones', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55, 56] })

    await addTransferInvoicesAction(10, [56, 88])

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { invoice: [55, 56, 88] } }),
    )
  })

  it('the same id twice in one batch attaches one page', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [] })

    await addTransferInvoicesAction(10, [88, 88, 89])

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { invoice: [88, 89] } }),
    )
  })

  it('first page on an invoice-less transfer → one-page list', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: null })

    await addTransferInvoicesAction(10, [88])

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { invoice: [88] } }))
  })

  it('an empty batch touches nothing', async () => {
    const result = await addTransferInvoicesAction(10, [])

    expect(result.success).toBe(true)
    expect(mockFindByID).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('payload.update failure → returns error', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [] })
    mockUpdate.mockRejectedValueOnce(new Error('Invoice update failed'))

    const result = await addTransferInvoicesAction(10, [88])

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Invoice update failed')
  })
})

describe('removeTransferInvoiceAction', () => {
  it('drops one page and leaves the rest in order', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55, 56, 57] })

    const result = await removeTransferInvoiceAction(10, 56)

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { invoice: [55, 57] } }),
    )
  })

  it('deletes only the media the new list dropped', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55, 56, 57] })

    await removeTransferInvoiceAction(10, 56)

    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 56 }),
    )
    expect(mockDelete).toHaveBeenCalledTimes(1)
  })

  it('removing a page that is not attached changes nothing', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55] })

    await removeTransferInvoiceAction(10, 99)

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { invoice: [55] } }))
    expect(mockDelete).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'media' }))
  })
})

describe('removeAllTransferInvoicesAction', () => {
  it('clears the list and deletes every page', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55, 56] })

    const result = await removeAllTransferInvoicesAction(10)

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { invoice: [] } }))
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 55 }),
    )
    expect(mockDelete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 56 }),
    )
  })

  it('a transfer with no invoice → clears to an empty list, deletes nothing', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: null })

    await removeAllTransferInvoicesAction(10)

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { invoice: [] } }))
    expect(mockDelete).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'media' }))
  })
})

describe('deleteOrphanedMediaAction', () => {
  // The add form uploads every page before it creates the expense, so a failed create leaves files
  // in Blob with nothing pointing at them — unreachable, but still billed for.
  it('deletes ids nothing references', async () => {
    const result = await deleteOrphanedMediaAction([101, 102, 103])

    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledTimes(3)
    expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 101 })
    expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 103 })
  })

  // The ids come straight from the browser and the join-table FK cascades, so an unguarded delete
  // would let any caller strip pages off other people's expenses.
  it('refuses an id a transfer still references', async () => {
    mockCount.mockResolvedValueOnce({ totalDocs: 1 })

    await deleteOrphanedMediaAction([101, 102])

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 102 })
  })

  it('a failing delete does not stop the rest', async () => {
    mockDelete.mockRejectedValueOnce(new Error('blob gone'))

    const result = await deleteOrphanedMediaAction([101, 102])

    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledTimes(2)
  })
})
