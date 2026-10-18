import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { BONUS_FORBIDDEN_MESSAGE } from '@/lib/auth/roles'
import { flushAfter } from '@/__tests__/stubs/next-server'

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
// Resolves to the ids still referenced somewhere — those survive the orphan reclaim.
const mockFindReferences = vi.fn()
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

const mockDbExecute = vi.fn()

vi.mock('@/lib/db/get-db', () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockDbExecute(...args),
  }),
}))
const mockRecordDetachments = vi.fn()
vi.mock('@/lib/db/media-detachments', () => ({
  recordDetachments: (...args: unknown[]) => mockRecordDetachments(...args),
  findReferencedMediaIds: (...args: unknown[]) => mockFindReferences(...args),
  closeDetachments: vi.fn(),
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

const TX_ID = 'test-tx-id'
const INVOICE_FIELD = { collection: 'transactions', field: 'invoice', id: 10 }

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
  mockRecordDetachments.mockReset()
  mockFindReferences.mockReset().mockResolvedValue([])
  mockBeginTransaction.mockReset().mockResolvedValue(TX_ID)
  mockCommitTransaction.mockReset().mockResolvedValue(undefined)
  mockRollbackTransaction.mockReset().mockResolvedValue(undefined)
  mockRequireAuth.mockReset().mockResolvedValue({ success: true, user: adminUser })
  mockDbExecute.mockReset().mockResolvedValue({ rows: [defaultDbRow()] })
  mockSyncSingle.mockReset()
  mockSyncBulk.mockReset()
  mockRemoveFromSheet.mockReset()
})

describe('createTransferAction', () => {
  // `success` alone cannot tell "the row landed as asked" from "the row landed wrong", since
  // payload.create is mocked and the hook that would clear a stray investment never runs here.
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

  it.each([
    ['no amount', { amount: undefined }],
    ['an unknown type', { type: 'INVALID_TYPE' }],
    ['no date', { date: '' }],
  ])('refuses a transfer with %s', async (_label, overrides) => {
    const result = await createTransferAction(makeSingleTransferData(overrides) as never)

    expect(result.success).toBe(false)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['its page list', [42, 43], [42, 43]],
    ['no page list', undefined, undefined],
  ])('passes %s straight to payload.create', async (_label, pages, invoice) => {
    await createTransferAction(makeSingleTransferData(), pages)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ invoice }) }),
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

describe('createBulkTransferAction', () => {
  it('books each line with its own data in one transaction', async () => {
    const result = await createBulkTransferAction(makeBulkTransferData(3))

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(mockBeginTransaction).toHaveBeenCalledOnce()
    expect(mockCommitTransaction).toHaveBeenCalledWith(TX_ID)
    expect(mockRollbackTransaction).not.toHaveBeenCalled()

    for (let i = 0; i < 3; i++) {
      expect(mockCreate.mock.calls[i][0]).toEqual(
        expect.objectContaining({
          collection: 'transactions',
          req: { transactionID: TX_ID, context: { skipSheetSync: true } },
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

  it.each([
    ['no line items', { lineItems: [] }],
    ['a zero-amount line', { lineItems: [{ description: 'Bad', amount: 0, expenseCategory: 1 }] }],
  ])('refuses a batch with %s', async (_label, overrides) => {
    const result = await createBulkTransferAction(makeBulkTransferData(1, overrides) as never)

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

  const writtenWorkers = () => mockCreate.mock.calls.map((call) => call[0].data.worker)

  it('OTHER writes each row its own worker, or none', async () => {
    await createBulkTransferAction({
      type: 'OTHER' as const,
      date: '2026-10-08',
      paymentMethod: 'CASH' as const,
      sourceRegister: 1,
      lineItems: [
        { description: 'Wiertarka', amount: 300, category: 9, worker: 5 },
        { description: 'Wkrętarka', amount: 200, category: 9 },
      ],
    })

    expect(writtenWorkers()).toEqual([5, undefined])
  })

  it('PAYOUT writes the form-level worker into every row, ignoring a per-row one', async () => {
    await createBulkTransferAction({
      type: 'PAYOUT' as const,
      date: '2026-10-08',
      paymentMethod: 'CASH' as const,
      sourceRegister: 1,
      worker: 9,
      lineItems: [
        { description: 'Zaliczka', amount: 300, worker: 5 },
        { description: 'Zaliczka', amount: 200 },
      ],
    })

    expect(writtenWorkers()).toEqual([9, 9])
  })
})

describe('BONUS — only ADMIN / OWNER grant a premia', () => {
  const bonus = { type: 'BONUS' as const, sourceRegister: undefined, worker: 1 }

  it('refuses a MANAGER on the bulk path, writing nothing', async () => {
    mockRequireAuth.mockResolvedValue({ success: true, user: managerUser })

    const result = await createBulkTransferAction(makeBulkTransferData(1, bonus))

    expect(result).toEqual({ success: false, error: BONUS_FORBIDDEN_MESSAGE })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it.each([ownerUser, adminUser])('lets $role book one', async (user) => {
    mockRequireAuth.mockResolvedValue({ success: true, user })

    const result = await createTransferAction(makeSingleTransferData(bonus))

    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledOnce()
  })
})

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

describe.each([
  [
    'cancelTransferAction',
    () => cancelTransferAction(10, { reason: VALID_CANCEL_REASON }),
    'anulowania',
  ],
  ['updateTransferAction', () => updateTransferAction(10, makeUpdateData()), 'edycji'],
])('%s — reading and authorizing the transfer', (_action, run, verb) => {
  it.each([
    ['its MANAGER creator', managerUser, managerUser.id],
    [
      'its MANAGER creator, createdBy populated',
      managerUser,
      { id: managerUser.id, name: 'Manager' },
    ],
    ['an ADMIN', adminUser, managerUser.id],
    ['an OWNER', ownerUser, managerUser.id],
  ])('lets %s through', async (_label, user, createdBy) => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user })
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy }))

    expect((await run()).success).toBe(true)
  })

  it.each([
    ['a missing transfer', adminUser, null, 'Transakcja nie istnieje.'],
    [
      'an anulowanie',
      adminUser,
      makeOriginalTransfer({ type: 'CANCELLATION', createdBy: adminUser.id }),
      'Nie można edytować anulowania.',
    ],
    [
      "another MANAGER's transfer",
      otherManagerUser,
      makeOriginalTransfer({ createdBy: managerUser.id }),
      `Nie masz uprawnień do ${verb} tej transakcji.`,
    ],
  ])('refuses %s, writing nothing', async (_label, user, original, error) => {
    mockRequireAuth.mockResolvedValueOnce({ success: true, user })
    mockFindByID.mockResolvedValueOnce(original)

    expect(await run()).toEqual({ success: false, error })
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('reads the transfer at depth 0', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))

    await run()

    expect(mockFindByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'transactions', id: 10, depth: 0 }),
    )
  })

  it('payload.update failure → returns error, writing nothing after it', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))
    mockUpdate.mockRejectedValueOnce(new Error('Update failed'))

    const result = await run()

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe('Update failed')
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('cancelTransferAction', () => {
  it('the CANCELLATION row is booked by the canceller and borrows no payment method', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ createdBy: managerUser.id, paymentMethod: 'CASH' }),
    )

    await cancelTransferAction(10, { reason: VALID_CANCEL_REASON })

    const { data } = mockCreate.mock.calls[0][0]
    expect(data).toEqual(expect.objectContaining({ type: 'CANCELLATION', createdBy: adminUser.id }))
    // The original's method is NOT copied: an anulowanie was never asked how it was paid, and a
    // borrowed „Gotówka" would answer for it in the column and the filter.
    expect(data).not.toHaveProperty('paymentMethod')
  })
})

describe('updateTransferAction', () => {
  it('success → updates transaction with editable fields + updatedBy', async () => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ createdBy: adminUser.id }))

    const result = await updateTransferAction(10, makeUpdateData({ investment: 3 }))

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        id: 10,
        data: expect.objectContaining({
          description: 'Updated description',
          date: '2026-03-01',
          paymentMethod: 'CASH',
          investment: 3,
          updatedBy: adminUser.id,
        }),
      }),
    )
  })

  // It decides which side of the settlement the wpłata
  // pays, so an edit would rewrite a bilans the client has already seen
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

  const editLegacyDeposit = (edit: object) => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ type: 'INVESTOR_DEPOSIT', vatPlane: null, createdBy: adminUser.id }),
    )
    return updateTransferAction(10, makeUpdateData(edit))
  }

  it.each([
    ['the plane the edit names', 'GROSS', 400, 400],
    ['gotówka with no netto', 'NET', undefined, null],
  ])('a legacy wpłata with no plane takes %s', async (_label, vatPlane, netAmount, written) => {
    const result = await editLegacyDeposit({ vatPlane, netAmount })

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vatPlane, netAmount: written }),
      }),
    )
  })

  it.each([
    ['no netto at all', undefined, 'Kwota netto jest wymagana'],
    ['a netto above the brutto', 900, 'Kwota netto nie może przekraczać kwoty brutto'],
  ])('refuses a brutto fill-in with %s', async (_label, netAmount, error) => {
    const result = await editLegacyDeposit({ vatPlane: 'GROSS', netAmount })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBe(error)
    expect(mockUpdate).not.toHaveBeenCalled()
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

  it('does not sync the sheet directly from the action (hook owns it now)', async () => {
    mockFindByID.mockResolvedValueOnce(
      makeOriginalTransfer({ createdBy: adminUser.id, investment: 2 }),
    )

    await updateTransferAction(10, makeUpdateData({ investment: 9 }))

    expect(mockSyncSingle).not.toHaveBeenCalled()
    expect(mockRemoveFromSheet).not.toHaveBeenCalled()
  })

  it.each([
    ['OTHER sets the worker', 'OTHER', 3, 3],
    ['OTHER clears the worker with null', 'OTHER', null, null],
    ['PAYOUT drops the worker key', 'PAYOUT', 3, 'absent'],
  ])('%s', async (_label, type, worker, written) => {
    mockFindByID.mockResolvedValueOnce(makeOriginalTransfer({ type, createdBy: adminUser.id }))

    await updateTransferAction(10, makeUpdateData({ worker }))

    const { data } = mockUpdate.mock.calls[0][0]
    expect('worker' in data ? data.worker : 'absent').toBe(written)
  })
})

describe('addTransferInvoicesAction', () => {
  // setUploadField is a read-modify-write, so every batch must land in ONE update.
  it.each([
    ['appends the new page to the pages already attached', [55, 56], [88], [55, 56, 88]],
    ['a whole batch lands in pick order', [55], [88, 89, 90], [55, 88, 89, 90]],
    ['reads ids out of populated media docs', [{ id: 55, filename: 'p1.jpg' }], [88], [55, 88]],
    ['re-adding an attached page is a no-op rather than a duplicate', [88], [88], [88]],
    [
      'a batch mixing attached and new ids appends only the new ones',
      [55, 56],
      [56, 88],
      [55, 56, 88],
    ],
    ['the same id twice in one batch attaches one page', [], [88, 88, 89], [88, 89]],
    ['first page on an invoice-less transfer → one-page list', null, [88], [88]],
  ])('%s', async (_label, attached, added, invoice) => {
    mockFindByID.mockResolvedValueOnce({ invoice: attached })

    const result = await addTransferInvoicesAction(10, added)

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledOnce()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'transactions', id: 10, data: { invoice } }),
    )
    await flushAfter()
    expect(mockDelete).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'media' }))
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

  it('moves only the dropped page to the trash, deleting nothing', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55, 56, 57] })

    await removeTransferInvoiceAction(10, 56)

    expect(mockRecordDetachments).toHaveBeenCalledWith(expect.anything(), INVOICE_FIELD, [56])
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('removing a page that is not attached changes nothing', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55] })

    await removeTransferInvoiceAction(10, 99)

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { invoice: [55] } }))
    expect(mockRecordDetachments).toHaveBeenCalledWith(expect.anything(), INVOICE_FIELD, [])
  })
})

describe('removeAllTransferInvoicesAction', () => {
  it('clears the list and moves every page to the trash', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: [55, 56] })

    const result = await removeAllTransferInvoicesAction(10)

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { invoice: [] } }))
    expect(mockRecordDetachments).toHaveBeenCalledWith(expect.anything(), INVOICE_FIELD, [55, 56])
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('a transfer with no invoice → clears to an empty list, trashes nothing', async () => {
    mockFindByID.mockResolvedValueOnce({ invoice: null })

    await removeAllTransferInvoicesAction(10)

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { invoice: [] } }))
    expect(mockRecordDetachments).toHaveBeenCalledWith(expect.anything(), INVOICE_FIELD, [])
  })
})

describe('deleteOrphanedMediaAction', () => {
  it('deletes ids nothing references', async () => {
    const result = await deleteOrphanedMediaAction([101, 102, 103])
    await flushAfter()

    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledTimes(3)
    expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 101 })
    expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 103 })
  })

  // The ids come straight from the browser and the join-table FK cascades, so an unguarded delete
  // would let any caller strip pages off other people's expenses.
  it('refuses an id a transfer still references', async () => {
    mockFindReferences.mockResolvedValueOnce([101])

    await deleteOrphanedMediaAction([101, 102])
    await flushAfter()

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDelete).toHaveBeenCalledWith({ collection: 'media', id: 102 })
  })

  it('a failing delete does not stop the rest', async () => {
    mockDelete.mockRejectedValueOnce(new Error('blob gone'))

    const result = await deleteOrphanedMediaAction([101, 102])
    await flushAfter()

    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalledTimes(2)
  })
})
