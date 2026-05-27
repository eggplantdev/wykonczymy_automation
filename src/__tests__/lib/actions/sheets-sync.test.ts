import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

vi.mock('server-only', () => ({}))

// ── googleapis mocks ─────────────────────────────────────────────────────
// We intercept at the boundary so getClient() returns these mocks.

const valuesGetMock = vi.fn()
const valuesAppendMock = vi.fn()
const valuesUpdateMock = vi.fn()
const valuesBatchUpdateMock = vi.fn()
const spreadsheetsGetMock = vi.fn()
const batchUpdateMock = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(function (this: object) {
        return this
      }),
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: {
        get: spreadsheetsGetMock,
        batchUpdate: batchUpdateMock,
        values: {
          get: valuesGetMock,
          append: valuesAppendMock,
          update: valuesUpdateMock,
          batchUpdate: valuesBatchUpdateMock,
        },
      },
    }),
  },
}))

// The sheet's header row — the sync locates fields by these names.
const SHEET_HEADER = [
  'id',
  'data',
  'typ wydatku inwestycyjnego',
  'opis',
  'kwota',
  'kategoria',
  'notatka',
]

// ── payload mock ─────────────────────────────────────────────────────────

const findMock = vi.fn()
const findByIDMock = vi.fn()

const mockPayload = {
  find: findMock,
  findByID: findByIDMock,
} as unknown as Payload

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn().mockResolvedValue(mockPayload),
  }
})

// ── auth + cache mocks ───────────────────────────────────────────────────

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    success: true,
    user: { id: 1, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  }),
}))

vi.mock('@/lib/cache/revalidate', () => ({
  revalidateCollections: vi.fn(),
}))

const {
  previewMaterialSync,
  applyMaterialSync,
  syncSingleTransferToSheet,
  removeTransferFromSheet,
} = await import('@/lib/actions/sheets-sync')

// ── helpers ──────────────────────────────────────────────────────────────

function setEnv() {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'test@x.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n',
  })
}

// First find (loadAppMaterialRows) returns the expenses; any later find (e.g. the
// reconciler's orphan-id lookup) defaults to empty.
function findReturns(expenses: object[]) {
  findMock.mockResolvedValueOnce({ docs: expenses }).mockResolvedValue({ docs: [] })
}

// The sync reads the whole grid and locates the header row, then scans the id
// column below it. We prepend the header, so transferId i lands on sheet row i+2.
function sheetColIReturns(transferIds: Array<number | null>) {
  const values = [SHEET_HEADER, ...transferIds.map((id) => (id === null ? [] : [id]))]
  valuesGetMock.mockResolvedValue({ data: { values } })
}

function makeMaterialTransaction(
  id: number,
  categoryName: 'Materiały budowlane' | 'Materiały wykończeniowe',
  overrides: Partial<{ amount: number; description: string; date: string }> = {},
) {
  return {
    id,
    type: 'INVESTMENT_EXPENSE',
    expenseCategory: { name: categoryName },
    amount: overrides.amount ?? 100,
    description: overrides.description ?? `tx-${id}`,
    date: overrides.date ?? '2026-05-21T00:00:00Z',
  }
}

beforeEach(() => {
  valuesGetMock.mockReset()
  valuesAppendMock.mockReset()
  valuesUpdateMock.mockReset()
  valuesBatchUpdateMock.mockReset()
  valuesBatchUpdateMock.mockResolvedValue({ data: {} })
  spreadsheetsGetMock.mockReset()
  batchUpdateMock.mockReset()
  findMock.mockReset()
  findByIDMock.mockReset()
  setEnv()
})

// ── previewMaterialSync ──────────────────────────────────────────────────

describe('previewMaterialSync', () => {
  it('rejects when investment has no googleSheetId', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: null })

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/arkusza/i)
    // Never touched Google when there is nothing to read against.
    expect(valuesGetMock).not.toHaveBeenCalled()
  })

  it('returns toAppend for DB expenses that are not in the sheet', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
    findReturns([
      makeMaterialTransaction(101, 'Materiały budowlane', { amount: 250, description: 'cement' }),
      makeMaterialTransaction(102, 'Materiały wykończeniowe', { amount: 80, description: 'farba' }),
    ])
    sheetColIReturns([]) // empty sheet

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.toAppend).toHaveLength(2)
    expect(result.data.toAppend.map((r) => r.transferId).sort()).toEqual([101, 102])
  })

  it('queries only non-cancelled investment expenses', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
    findReturns([])
    sheetColIReturns([])

    await previewMaterialSync(31)

    const whereArg = findMock.mock.calls[0][0].where
    expect(whereArg.and).toEqual(expect.arrayContaining([{ cancelled: { not_equals: true } }]))
  })

  it('skips an expense whose amount is not a finite number', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
    findReturns([
      makeMaterialTransaction(101, 'Materiały budowlane', { amount: 250 }),
      // amount '' → Number('')===0, amount 'x' → NaN: both must be dropped, not synced.
      { ...makeMaterialTransaction(102, 'Materiały budowlane'), amount: '' },
      { ...makeMaterialTransaction(103, 'Materiały budowlane'), amount: 'x' },
    ])
    sheetColIReturns([]) // empty sheet

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.toAppend.map((r) => r.transferId)).toEqual([101])
  })

  it('does not re-append rows already present in the sheet', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
    findReturns([makeMaterialTransaction(101, 'Materiały budowlane', { amount: 250 })])
    sheetColIReturns([101]) // already synced

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.toAppend).toEqual([])
  })
})

// ── applyMaterialSync ────────────────────────────────────────────────────

describe('applyMaterialSync', () => {
  it('rejects when investment has no googleSheetId', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: null })

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/arkusza/i)
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled()
  })

  // The rows are re-derived server-side from the DB (not trusted from a client-
  // supplied preview). Present rows are now OVERWRITTEN by id (drift heal), not skipped.
  it('overwrites an expense already present in the sheet (drift heal)', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
    findReturns([makeMaterialTransaction(5, 'Materiały budowlane', { amount: 100 })])
    sheetColIReturns([5]) // already synced → row 2

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({ added: 0, updated: 1, removed: 0, errors: [] })
    // one write, targeting the existing row 2
    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[0].range).toBe(
      "'wydatki inwestycyjne (tylko do odczytu)'!A2",
    )
  })

  it('appends an expense that the DB has but the sheet is missing', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
    findReturns([
      makeMaterialTransaction(7, 'Materiały budowlane', { amount: 250, description: 'cement' }),
    ])
    sheetColIReturns([]) // empty sheet

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({ added: 1, updated: 0, removed: 0, errors: [] })
    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
  })

  it('removes orphan rows that are real transactions but keeps manual rows', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: 'X', googleSheetId: 'sheet-1' })
    // loadApp expenses (1st find) → active expense #7; orphan lookup (2nd find) → #8 is a real tx
    findMock
      .mockResolvedValueOnce({
        docs: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })],
      })
      .mockResolvedValueOnce({ docs: [{ id: 8 }] })
    // sheet has the active #7, a real-but-orphan #8 (e.g. cancelled), and a manual #9999
    sheetColIReturns([7, 8, 9999])
    // removeMaterialRow needs the tab gid
    spreadsheetsGetMock.mockResolvedValue({
      data: {
        sheets: [{ properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({ added: 0, updated: 1, removed: 1, errors: [] })
    // exactly one row deleted, and it is #8's row (sheet row 3 → startRowIndex 2), never #9999
    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    expect(
      batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteRange.range.startRowIndex,
    ).toBe(2)
  })

  it('scopes the orphan-removal guard to this investment and INVESTMENT_EXPENSE', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: 'X', googleSheetId: 'sheet-1' })
    findMock
      .mockResolvedValueOnce({
        docs: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })],
      })
      .mockResolvedValueOnce({ docs: [] })
    sheetColIReturns([7, 8])

    await applyMaterialSync(31)

    // The orphan lookup (2nd find) must filter by id + investment + type, NOT id alone —
    // otherwise a manual number colliding with an unrelated transaction id is deleted.
    const orphanWhere = findMock.mock.calls[1][0].where
    expect(orphanWhere.and).toEqual(
      expect.arrayContaining([
        { id: { in: [8] } },
        { investment: { equals: 31 } },
        { type: { equals: 'INVESTMENT_EXPENSE' } },
      ]),
    )
  })

  it('keeps a row whose id collides with a transaction that is not this investment expense', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: 'X', googleSheetId: 'sheet-1' })
    // #7 is the active expense; #8 is a manual number that happens to equal a real PAYOUT
    // id — the scoped guard returns no matching expense, so #8 must be left untouched.
    findMock
      .mockResolvedValueOnce({
        docs: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })],
      })
      .mockResolvedValueOnce({ docs: [] })
    sheetColIReturns([7, 8])
    spreadsheetsGetMock.mockResolvedValue({
      data: {
        sheets: [{ properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.removed).toBe(0)
    expect(batchUpdateMock).not.toHaveBeenCalled()
  })
})

// ── syncSingleTransferToSheet ──────────────────────────────────────────────

describe('syncSingleTransferToSheet', () => {
  it('updates the existing row in place when the transfer is already on the sheet', async () => {
    // transaction lookup, then its investment lookup
    findByIDMock.mockImplementation(({ collection }: { collection: string }) =>
      collection === 'transactions'
        ? Promise.resolve({
            id: 101,
            type: 'INVESTMENT_EXPENSE',
            investment: 31,
            expenseCategory: { name: 'Materiały budowlane' },
            amount: 999,
            description: 'edited',
            date: '2026-05-27T00:00:00Z',
          })
        : Promise.resolve({ id: 31, googleSheetId: 'sheet-1' }),
    )
    sheetColIReturns([101]) // id already present → row 2

    await syncSingleTransferToSheet({ transferId: 101 })

    // exactly one write, and it targets the existing row 2 (update), not row 3 (append)
    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[0].range).toBe(
      "'wydatki inwestycyjne (tylko do odczytu)'!A2",
    )
    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[4].values).toEqual([[999]])
  })

  it('removes the original expense row from its sheet when a CANCELLATION is synced', async () => {
    // 1st transactions lookup: the cancellation; 2nd: the original expense; then investment
    findByIDMock.mockImplementation(({ collection, id }: { collection: string; id: number }) => {
      if (collection === 'investments') return Promise.resolve({ id: 31, googleSheetId: 'sheet-1' })
      if (id === 2460)
        return Promise.resolve({ id: 2460, type: 'CANCELLATION', cancelledTransaction: 2459 })
      return Promise.resolve({ id: 2459, type: 'INVESTMENT_EXPENSE', investment: 31 })
    })
    sheetColIReturns([2459]) // original sits on row 2 of the sheet
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [{ properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })

    await syncSingleTransferToSheet({ transferId: 2460 })

    // It deletes the ORIGINAL's row (#2459 at row 2) — data columns only, so the
    // summary in column H survives — and appends nothing.
    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    expect(batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteRange).toEqual({
      range: {
        sheetId: 5,
        startRowIndex: 1,
        endRowIndex: 2,
        startColumnIndex: 0,
        endColumnIndex: 7,
      },
      shiftDimension: 'ROWS',
    })
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled() // no append/update
  })
})

// ── removeTransferFromSheet ────────────────────────────────────────────────

describe('removeTransferFromSheet', () => {
  it('removes the row from the given investment’s sheet', async () => {
    findByIDMock.mockResolvedValue({ id: 31, googleSheetId: 'sheet-old' })
    sheetColIReturns([55]) // id 55 on row 2 of the old sheet
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [{ properties: { sheetId: 12, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })

    await removeTransferFromSheet({ transferId: 55, investmentId: 31 })

    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    expect(batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteRange).toEqual({
      range: {
        sheetId: 12,
        startRowIndex: 1,
        endRowIndex: 2,
        startColumnIndex: 0,
        endColumnIndex: 7,
      },
      shiftDimension: 'ROWS',
    })
  })

  it('no-ops when the investment has no googleSheetId', async () => {
    findByIDMock.mockResolvedValue({ id: 31, googleSheetId: null })
    await removeTransferFromSheet({ transferId: 55, investmentId: 31 })
    expect(valuesGetMock).not.toHaveBeenCalled()
    expect(batchUpdateMock).not.toHaveBeenCalled()
  })
})
