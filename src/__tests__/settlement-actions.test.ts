import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}))

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockFindByID = vi.fn()
const mockBeginTransaction = vi.fn()
const mockCommitTransaction = vi.fn()
const mockRollbackTransaction = vi.fn()

const mockPayload = {
  create: mockCreate,
  update: mockUpdate,
  findByID: mockFindByID,
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

const mockRequireAuth = vi.fn().mockResolvedValue({ success: true, user: mockUser })

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: mockRequireAuth,
}))

const mockUploadBulkInvoices = vi.fn().mockResolvedValue([undefined])
const mockUploadSingleInvoice = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/upload-invoice', () => ({
  uploadBulkInvoices: mockUploadBulkInvoices,
  uploadSingleInvoice: mockUploadSingleInvoice,
}))

vi.mock('@/lib/cache/revalidate', () => ({
  revalidateCollections: vi.fn(),
}))

const mockSumEmployeeSaldo = vi.fn().mockResolvedValue(500)

vi.mock('@/lib/db/sum-transfers', () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: vi.fn().mockResolvedValue({
      rows: [{ id: 1, name: 'Main', type: 'MAIN', active: true, owner_id: 1 }],
    }),
  }),
  sumRegisterBalance: vi.fn().mockResolvedValue(99999),
  sumEmployeeSaldo: mockSumEmployeeSaldo,
}))

const { createSettlementAction, getManagementEmployeeSaldo } =
  await import('@/lib/actions/settlements')

// ── Helpers ──────────────────────────────────────────────────────────────

const TX_ID = 'test-tx-id'

function makeRegisterData(overrides: Record<string, unknown> = {}) {
  return {
    worker: 1,
    mode: 'register' as const,
    sourceRegister: 1,
    amount: 250,
    description: '',
    date: '2026-02-25',
    paymentMethod: 'CASH' as const,
    invoiceNote: '',
    lineItems: [],
    ...overrides,
  }
}

function makeInvestmentData(itemCount: number, overrides: Record<string, unknown> = {}) {
  return {
    worker: 1,
    mode: 'investment' as const,
    investment: 1,
    date: '2026-02-25',
    paymentMethod: 'CASH' as const,
    invoiceNote: '',
    lineItems: Array.from({ length: itemCount }, (_, i) => ({
      description: `Item ${i + 1}`,
      amount: 100,
    })),
    ...overrides,
  }
}

function makeCategoryData(itemCount: number, overrides: Record<string, unknown> = {}) {
  return {
    worker: 1,
    mode: 'category' as const,
    date: '2026-02-25',
    paymentMethod: 'CASH' as const,
    invoiceNote: '',
    lineItems: Array.from({ length: itemCount }, (_, i) => ({
      description: `Category item ${i + 1}`,
      amount: 50,
      category: 10 + i,
      note: `Note ${i + 1}`,
    })),
    ...overrides,
  }
}

beforeEach(() => {
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockFindByID.mockReset()
  mockBeginTransaction.mockReset().mockResolvedValue(TX_ID)
  mockCommitTransaction.mockReset().mockResolvedValue(undefined)
  mockRollbackTransaction.mockReset().mockResolvedValue(undefined)
  mockRequireAuth.mockReset().mockResolvedValue({ success: true, user: mockUser })
  mockUploadBulkInvoices.mockReset().mockResolvedValue([undefined])
  mockUploadSingleInvoice.mockReset().mockResolvedValue(undefined)
  mockSumEmployeeSaldo.mockReset().mockResolvedValue(500)
})

// ═════════════════════════════════════════════════════════════════════════
// Register mode (single create, no transaction)
// ═════════════════════════════════════════════════════════════════════════

describe('createSettlementAction — register mode', () => {
  it('valid register refund → creates single EMPLOYEE_EXPENSE with sourceRegister', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    const result = await createSettlementAction(makeRegisterData(), null)

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        data: expect.objectContaining({
          type: 'EMPLOYEE_EXPENSE',
          sourceRegister: 1,
          amount: 250,
          worker: 1,
        }),
      }),
    )
  })

  it('default description "Zwrot do kasy" when description is empty', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    await createSettlementAction(makeRegisterData({ description: '' }), null)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Zwrot do kasy',
        }),
      }),
    )
  })

  it('custom description preserved when provided', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    await createSettlementAction(makeRegisterData({ description: 'Opłata za materiały' }), null)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Opłata za materiały',
        }),
      }),
    )
  })

  it('missing sourceRegister → validation error', async () => {
    const result = await createSettlementAction(
      makeRegisterData({ sourceRegister: undefined }),
      null,
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Kasa jest wymagana')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('missing amount → validation error', async () => {
    const result = await createSettlementAction(makeRegisterData({ amount: undefined }), null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Kwota musi być większa niż 0')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('zero amount → validation error', async () => {
    const result = await createSettlementAction(makeRegisterData({ amount: 0 }), null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Kwota musi być większa niż 0')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('missing worker → validation error', async () => {
    const result = await createSettlementAction(makeRegisterData({ worker: undefined }), null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Pracownik jest wymagany')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('no transaction used → beginTransaction NOT called', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    await createSettlementAction(makeRegisterData(), null)

    expect(mockBeginTransaction).not.toHaveBeenCalled()
    expect(mockCommitTransaction).not.toHaveBeenCalled()
    expect(mockRollbackTransaction).not.toHaveBeenCalled()
  })

  it('creates with correct fields → type, paymentMethod, date, worker, createdBy', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    await createSettlementAction(
      makeRegisterData({ date: '2026-03-15', paymentMethod: 'CASH' }),
      null,
    )

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        data: expect.objectContaining({
          type: 'EMPLOYEE_EXPENSE',
          paymentMethod: 'CASH',
          date: '2026-03-15',
          worker: 1,
          createdBy: mockUser.id,
        }),
      }),
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════
// Investment mode (bulk with transaction)
// ═════════════════════════════════════════════════════════════════════════

describe('createSettlementAction — investment mode', () => {
  it('valid with 1 item → transaction used, 1 create', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue([undefined])

    const result = await createSettlementAction(makeInvestmentData(1), null)

    expect(result.success).toBe(true)
    expect(mockBeginTransaction).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCommitTransaction).toHaveBeenCalledWith(TX_ID)
  })

  it('valid with 5 items → transaction used, 5 creates', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue(Array(5).fill(undefined))

    const result = await createSettlementAction(makeInvestmentData(5), null)

    expect(result.success).toBe(true)
    expect(mockBeginTransaction).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledTimes(5)
    expect(mockCommitTransaction).toHaveBeenCalledWith(TX_ID)
  })

  it('large batch (40 items) → all 40 sequential creates within transaction', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue(Array(40).fill(undefined))

    const result = await createSettlementAction(makeInvestmentData(40), null)

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(40)
    expect(mockBeginTransaction).toHaveBeenCalledOnce()
    expect(mockCommitTransaction).toHaveBeenCalledWith(TX_ID)
  })

  it('each item created with investment field set, no otherCategory', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue([undefined, undefined, undefined])

    await createSettlementAction(makeInvestmentData(3), null)

    for (const call of mockCreate.mock.calls) {
      expect(call[0].data).toHaveProperty('investment', 1)
      expect(call[0].data.otherCategory).toBeUndefined()
    }
  })

  it('missing investment → validation error', async () => {
    const result = await createSettlementAction(
      makeInvestmentData(2, { investment: undefined }),
      null,
    )

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Inwestycja jest wymagana')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('empty lineItems → validation error', async () => {
    const result = await createSettlementAction(makeInvestmentData(0), null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Dodaj co najmniej jedną pozycję')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('line item with zero amount → validation error', async () => {
    const data = makeInvestmentData(1)
    data.lineItems[0].amount = 0

    const result = await createSettlementAction(data, null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Kwota musi być większa niż 0')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('transaction commit on success', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue([undefined, undefined])

    await createSettlementAction(makeInvestmentData(2), null)

    expect(mockCommitTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockRollbackTransaction).not.toHaveBeenCalled()
  })

  it('transaction rollback on failure at any item', async () => {
    mockCreate.mockRejectedValue(new Error('DB write failed'))
    mockUploadBulkInvoices.mockResolvedValue([undefined, undefined])

    const result = await createSettlementAction(makeInvestmentData(2), null)

    expect(result.success).toBe(false)
    expect(mockRollbackTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockCommitTransaction).not.toHaveBeenCalled()
  })

  it('rollback when 3rd of 5 fails → only 3 creates attempted', async () => {
    mockCreate
      .mockResolvedValueOnce({ id: 1 }) // item 1 OK
      .mockResolvedValueOnce({ id: 2 }) // item 2 OK
      .mockRejectedValueOnce(new Error('DB constraint violation')) // item 3 FAIL
    mockUploadBulkInvoices.mockResolvedValue(Array(5).fill(undefined))

    const result = await createSettlementAction(makeInvestmentData(5), null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('DB constraint violation')
    expect(mockRollbackTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockCommitTransaction).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  it('all creates share same transactionID via req', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue(Array(3).fill(undefined))

    await createSettlementAction(makeInvestmentData(3), null)

    for (const call of mockCreate.mock.calls) {
      expect(call[0]).toHaveProperty('req', { transactionID: TX_ID })
    }
  })

  it('invoice mediaIds mapped correctly per item', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue([101, undefined, 103])

    await createSettlementAction(makeInvestmentData(3), null)

    expect(mockCreate.mock.calls[0][0].data.invoice).toBe(101)
    expect(mockCreate.mock.calls[1][0].data.invoice).toBeUndefined()
    expect(mockCreate.mock.calls[2][0].data.invoice).toBe(103)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// Category mode (bulk with transaction)
// ═════════════════════════════════════════════════════════════════════════

describe('createSettlementAction — category mode', () => {
  it('valid with category per item → creates with otherCategory and otherDescription', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue([undefined, undefined])

    const result = await createSettlementAction(makeCategoryData(2), null)

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(2)

    expect(mockCreate.mock.calls[0][0].data).toMatchObject({
      otherCategory: 10,
      otherDescription: 'Note 1',
    })
    expect(mockCreate.mock.calls[1][0].data).toMatchObject({
      otherCategory: 11,
      otherDescription: 'Note 2',
    })
  })

  it('missing category per line item → validation error', async () => {
    const data = makeCategoryData(1)
    data.lineItems[0].category = undefined as any

    const result = await createSettlementAction(data, null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Kategoria jest wymagana')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('note is optional per line item → passes without note', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue([undefined])

    const data = makeCategoryData(1)
    data.lineItems[0].note = undefined as any

    const result = await createSettlementAction(data, null)

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('each item created with otherCategory set, no investment', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue([undefined, undefined])

    await createSettlementAction(makeCategoryData(2), null)

    for (const call of mockCreate.mock.calls) {
      expect(call[0].data.otherCategory).toBeDefined()
      expect(call[0].data.investment).toBeUndefined()
    }
  })

  it('transaction behavior same as investment mode → begin, commit, no rollback', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue([undefined, undefined, undefined])

    const result = await createSettlementAction(makeCategoryData(3), null)

    expect(result.success).toBe(true)
    expect(mockBeginTransaction).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(mockCommitTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockRollbackTransaction).not.toHaveBeenCalled()
  })

  it('transaction rollback on category mode failure', async () => {
    mockCreate
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(new Error('Foreign key error'))
    mockUploadBulkInvoices.mockResolvedValue([undefined, undefined])

    const result = await createSettlementAction(makeCategoryData(2), null)

    expect(result.success).toBe(false)
    expect(mockRollbackTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockCommitTransaction).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// Cross-mode tests
// ═════════════════════════════════════════════════════════════════════════

describe('createSettlementAction — cross-mode tests', () => {
  it('mode switching: register data with register mode → ignores lineItems', async () => {
    mockCreate.mockResolvedValue({ id: 1 })

    // Provide lineItems that would be used in investment mode, but mode is register
    const data = makeRegisterData({
      lineItems: [
        { description: 'Should be ignored', amount: 100 },
        { description: 'Also ignored', amount: 200 },
      ],
    })

    const result = await createSettlementAction(data, null)

    expect(result.success).toBe(true)
    // Only one create for the register refund, not per line item
    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockBeginTransaction).not.toHaveBeenCalled()
  })

  it('description now optional in line items → passes with empty description', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue([undefined])

    const data = makeInvestmentData(1)
    data.lineItems[0].description = ''

    const result = await createSettlementAction(data, null)

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('auth failure → returns error without any creates', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: false, error: 'Nie jesteś zalogowany' })

    const result = await createSettlementAction(makeInvestmentData(3), null)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Nie jesteś zalogowany')
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockBeginTransaction).not.toHaveBeenCalled()
  })

  it('uploadBulkInvoices called with correct count', async () => {
    mockCreate.mockResolvedValue({ id: 1 })
    mockUploadBulkInvoices.mockResolvedValue(Array(4).fill(undefined))

    await createSettlementAction(makeInvestmentData(4), null)

    expect(mockUploadBulkInvoices).toHaveBeenCalledWith(mockPayload, null, 4)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// getManagementEmployeeSaldo
// ═════════════════════════════════════════════════════════════════════════

describe('getManagementEmployeeSaldo', () => {
  it('returns saldo for authenticated user', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: mockUser })
    mockSumEmployeeSaldo.mockResolvedValueOnce(1234.56)

    const result = await getManagementEmployeeSaldo(42)

    expect(result).toEqual({ saldo: 1234.56 })
    expect(mockSumEmployeeSaldo).toHaveBeenCalledWith(mockPayload, 42)
  })

  it('returns zero saldo when employee has no transactions', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: mockUser })
    mockSumEmployeeSaldo.mockResolvedValueOnce(0)

    const result = await getManagementEmployeeSaldo(99)

    expect(result).toEqual({ saldo: 0 })
  })

  it('returns negative saldo when employee owes money', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: mockUser })
    mockSumEmployeeSaldo.mockResolvedValueOnce(-350)

    const result = await getManagementEmployeeSaldo(7)

    expect(result).toEqual({ saldo: -350 })
  })

  it('auth failure → throws error', async () => {
    mockRequireAuth.mockResolvedValueOnce({
      success: false,
      error: 'Brak uprawnień',
      user: null,
    })

    await expect(getManagementEmployeeSaldo(1)).rejects.toThrow('Brak uprawnień')
    expect(mockSumEmployeeSaldo).not.toHaveBeenCalled()
  })

  it('requireAuth called with MANAGEMENT_ROLES', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: mockUser })
    mockSumEmployeeSaldo.mockResolvedValueOnce(0)

    await getManagementEmployeeSaldo(1)

    // getManagementEmployeeSaldo calls requireAuth directly (not via withAction),
    // but the mock is shared. It should be called with MANAGEMENT_ROLES.
    // The first call in beforeEach is reset, so check the most recent call.
    expect(mockRequireAuth).toHaveBeenCalledWith(
      expect.arrayContaining(['ADMIN', 'OWNER', 'MANAGER']),
    )
  })

  it('sumEmployeeSaldo called with correct payload and workerId', async () => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user: mockUser })
    mockSumEmployeeSaldo.mockResolvedValueOnce(100)

    await getManagementEmployeeSaldo(55)

    expect(mockSumEmployeeSaldo).toHaveBeenCalledOnce()
    expect(mockSumEmployeeSaldo).toHaveBeenCalledWith(mockPayload, 55)
  })
})
