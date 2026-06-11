import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'

vi.mock('server-only', () => ({}))

// ── googleapis mocks ─────────────────────────────────────────────────────
// We intercept at the boundary so getClient() returns these mocks.

const valuesGetMock = vi.fn()
const valuesAppendMock = vi.fn()
const valuesUpdateMock = vi.fn()
const valuesBatchUpdateMock = vi.fn()
const valuesClearMock = vi.fn()
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
          clear: valuesClearMock,
        },
      },
    }),
  },
}))

// The sheet's header rows — the sync locates fields by these names.
const SHEET_HEADER = [
  'id',
  'data',
  'typ wydatku inwestycyjnego',
  'opis',
  'kwota',
  'kategoria',
  'notatka',
]
const TRANSFERS_HEADER = ['id', 'data', 'typ', 'opis', 'kwota', 'pracownik', 'kategoria', 'notatka']

// Spreadsheet metadata with both app-managed tabs present — the default for
// spreadsheets.get so ensureTab() no-ops instead of running a full setup.
const BOTH_TABS_META = {
  data: {
    sheets: [
      { properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } },
      { properties: { sheetId: 6, title: 'transfery (tylko do odczytu)' } },
    ],
  },
}

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

// Queue the kosztoryses lookup (the FIRST find call inside any action that
// resolves an investment's sheet via getInvestmentSheetId). Pass `null` to
// simulate an investment with no kosztorys row → action rejects with no-sheet.
function withSheet(investmentId: number, googleSheetId: string | null) {
  findMock.mockResolvedValueOnce({
    docs: googleSheetId ? [{ id: 1, googleSheetId, investment: investmentId }] : [],
  })
}

// Queue the expense lookup (loadAppMaterialRows). Subsequent finds (e.g. the
// reconciler's orphan-id lookup) default to empty. Tests that need to inspect
// the orphan-id call must use mockResolvedValueOnce themselves.
function findReturns(expenses: object[]) {
  findMock.mockResolvedValueOnce({ docs: expenses }).mockResolvedValue({ docs: [] })
}

// The sync reads the whole grid and locates the header row, then scans the id
// column below it. We prepend the header, so transferId i lands on sheet row i+2.
// Range-aware: the dual-tab sync reads BOTH tabs — dispatch on the requested
// range so each read sees its own tab's grid.
function sheetGrids(expenseIds: Array<number | null>, transferIds: Array<number | null> = []) {
  valuesGetMock.mockImplementation(({ range }: { range: string }) =>
    Promise.resolve({
      data: {
        values: range.startsWith("'transfery")
          ? [TRANSFERS_HEADER, ...transferIds.map((id) => (id === null ? [] : [id]))]
          : [SHEET_HEADER, ...expenseIds.map((id) => (id === null ? [] : [id]))],
      },
    }),
  )
}
const sheetColIReturns = (expenseIds: Array<number | null>) => sheetGrids(expenseIds)

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
  valuesClearMock.mockReset()
  valuesClearMock.mockResolvedValue({ data: {} })
  spreadsheetsGetMock.mockReset()
  spreadsheetsGetMock.mockResolvedValue(BOTH_TABS_META)
  batchUpdateMock.mockReset()
  findMock.mockReset()
  findByIDMock.mockReset()
  setEnv()
})

// ── previewMaterialSync ──────────────────────────────────────────────────

describe('previewMaterialSync', () => {
  it('rejects when investment has no linked kosztorys sheet', async () => {
    withSheet(31, null)

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/kosztorysu/i)
    // Never touched Google when there is nothing to read against.
    expect(valuesGetMock).not.toHaveBeenCalled()
  })

  it('returns toAppend for DB expenses that are not in the sheet', async () => {
    withSheet(31, 'sheet-1')
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
    withSheet(31, 'sheet-1')
    findReturns([])
    sheetColIReturns([])

    await previewMaterialSync(31)

    // findMock.calls[0] = kosztoryses lookup; [1] = expenses lookup.
    const whereArg = findMock.mock.calls[1][0].where
    expect(whereArg.and).toEqual(expect.arrayContaining([{ cancelled: { not_equals: true } }]))
  })

  it('reads an open-ended range and fetches all expenses (no row cap)', async () => {
    withSheet(31, 'sheet-1')
    findReturns([])
    sheetColIReturns([])

    await previewMaterialSync(31)

    // A capped find / range would silently drop rows past the cap, and the reconciler
    // would then delete their un-read sheet rows as orphans (T1.2).
    expect(findMock.mock.calls[1][0].limit).toBe(0)
    expect(valuesGetMock.mock.calls[0][0].range).toMatch(/!A:Z$/)
  })

  it('skips an expense whose amount is not a finite number', async () => {
    withSheet(31, 'sheet-1')
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
    withSheet(31, 'sheet-1')
    findReturns([makeMaterialTransaction(101, 'Materiały budowlane', { amount: 250 })])
    sheetColIReturns([101]) // already synced

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.toAppend).toEqual([])
  })

  it('reports update and remove counts, not just appends (T3.1)', async () => {
    withSheet(31, 'sheet-1')
    // active expenses #7 (present → refresh) and #9 (missing → append); #8 on the
    // sheet is this investment's orphan (a now-cancelled expense → remove).
    findMock
      .mockResolvedValueOnce({
        docs: [
          makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 }),
          makeMaterialTransaction(9, 'Materiały budowlane', { amount: 50 }),
        ],
      })
      .mockResolvedValueOnce({ docs: [{ id: 8 }] })
      .mockResolvedValue({ docs: [] })
    sheetColIReturns([7, 8])

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.toAppend.map((r) => r.transferId)).toEqual([9])
    expect(result.data.toUpdateCount).toBe(1) // #7 present → refreshed
    expect(result.data.toRemoveCount).toBe(1) // #8 orphan → removed
  })

  it('previews the transfers tab, treating a MISSING tab as all-appends (no throw)', async () => {
    withSheet(31, 'sheet-1')
    // [1] expenses load → none; [2] transfers load → one active PAYOUT
    findMock
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 20,
            type: 'PAYOUT',
            investment: 31,
            amount: 300,
            description: 'wypłata',
            date: '2026-06-01T00:00:00Z',
          },
        ],
      })
      .mockResolvedValue({ docs: [] })
    // expenses tab exists; the transfers tab does NOT (pre-feature sheet) — Google
    // reports a missing tab as an unparseable range.
    valuesGetMock.mockImplementation(({ range }: { range: string }) =>
      range.startsWith("'transfery")
        ? Promise.reject(new Error("Unable to parse range: 'transfery (tylko do odczytu)'!A:Z"))
        : Promise.resolve({ data: { values: [SHEET_HEADER] } }),
    )

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.transfersToAppend.map((r) => r.transferId)).toEqual([20])
    expect(result.data.transfersToUpdateCount).toBe(0)
    expect(result.data.transfersToRemoveCount).toBe(0)
  })
})

// ── applyMaterialSync ────────────────────────────────────────────────────

describe('applyMaterialSync', () => {
  it('rejects when investment has no linked kosztorys sheet', async () => {
    withSheet(31, null)

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/kosztorysu/i)
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled()
  })

  // The rows are re-derived server-side from the DB (not trusted from a client-
  // supplied preview). Present rows are now OVERWRITTEN by id (drift heal), not skipped.
  it('overwrites an expense already present in the sheet (drift heal)', async () => {
    withSheet(31, 'sheet-1')
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
    withSheet(31, 'sheet-1')
    findReturns([
      makeMaterialTransaction(7, 'Materiały budowlane', { amount: 250, description: 'cement' }),
    ])
    sheetColIReturns([]) // empty sheet

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({ added: 1, updated: 0, removed: 0, errors: [] })
    // appends are written at a computed row via batchUpdate (not values.append —
    // its table detection counts the summary column and skips the first data row)
    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
    expect(valuesAppendMock).not.toHaveBeenCalled()
  })

  it('removes orphan rows that are real transactions but keeps manual rows', async () => {
    withSheet(31, 'sheet-1')
    // loadApp expenses (2nd find) → active expense #7; orphan lookup (3rd find) → #8 is a real tx
    findMock
      .mockResolvedValueOnce({
        docs: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })],
      })
      .mockResolvedValueOnce({ docs: [{ id: 8 }] })
      .mockResolvedValue({ docs: [] })
    // sheet has the active #7, a real-but-orphan #8 (e.g. cancelled), and a manual #9999
    sheetColIReturns([7, 8, 9999])
    // removal resolves the tab gid from the BOTH_TABS_META default

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
    withSheet(31, 'sheet-1')
    findMock
      .mockResolvedValueOnce({
        docs: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })],
      })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValue({ docs: [] })
    sheetColIReturns([7, 8])

    await applyMaterialSync(31)

    // The orphan lookup (3rd find) must filter by id + investment + type, NOT id alone —
    // otherwise a manual number colliding with an unrelated transaction id is deleted.
    // findMock.calls[0] = kosztoryses; [1] = expenses; [2] = orphan-id lookup.
    const orphanWhere = findMock.mock.calls[2][0].where
    expect(orphanWhere.and).toEqual(
      expect.arrayContaining([
        { id: { in: [8] } },
        { investment: { equals: 31 } },
        { type: { equals: 'INVESTMENT_EXPENSE' } },
      ]),
    )
  })

  it('keeps a row whose id collides with a transaction that is not this investment expense', async () => {
    withSheet(31, 'sheet-1')
    // #7 is the active expense; #8 is a manual number that happens to equal a real PAYOUT
    // id — the scoped guard returns no matching expense, so #8 must be left untouched.
    findMock
      .mockResolvedValueOnce({
        docs: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })],
      })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValue({ docs: [] })
    sheetColIReturns([7, 8])

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.removed).toBe(0)
    expect(batchUpdateMock).not.toHaveBeenCalled()
  })
})

// ── applyMaterialSync — transfers tab ───────────────────────────────────────

describe('applyMaterialSync — transfers tab', () => {
  function makeTransfer(
    id: number,
    type: string,
    overrides: Partial<{ amount: number; worker: { name: string }; cancelled: boolean }> = {},
  ) {
    return {
      id,
      type,
      investment: 31,
      amount: overrides.amount ?? 100,
      description: `tx-${id}`,
      date: '2026-06-01T00:00:00Z',
      ...overrides,
    }
  }

  it('reconciles the transfers tab too and sums counts across tabs', async () => {
    withSheet(31, 'sheet-1')
    // [1] expenses load → #7 present on the sheet (update); [2] transfers load →
    // PAYOUT #20 missing from the transfers tab (append).
    findMock
      .mockResolvedValueOnce({
        docs: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })],
      })
      .mockResolvedValueOnce({
        docs: [makeTransfer(20, 'PAYOUT', { amount: 300, worker: { name: 'Jan' } })],
      })
      .mockResolvedValue({ docs: [] })
    sheetGrids([7], [])

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({ added: 1, updated: 1, removed: 0, errors: [] })
    // two writes: expenses tab first, transfers tab second
    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(2)
    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[0].range).toBe(
      "'wydatki inwestycyjne (tylko do odczytu)'!A2",
    )
    const transferCells = valuesBatchUpdateMock.mock.calls[1][0].requestBody.data
    expect(transferCells[0].range).toBe("'transfery (tylko do odczytu)'!A2")
    expect(transferCells).toHaveLength(8) // 8 mapped columns incl. pracownik
    expect(transferCells[2].values).toEqual([['Wypłata']]) // typ = PL label
    expect(transferCells[5].values).toEqual([['Jan']]) // F = pracownik
  })

  it('scopes the transfers orphan guard to this investment and the six types', async () => {
    withSheet(31, 'sheet-1')
    findMock.mockResolvedValue({ docs: [] })
    // transfers tab holds #55, which no longer maps to an active transfer
    sheetGrids([], [55])

    await applyMaterialSync(31)

    // [0] kosztoryses; [1] expenses load; [2] transfers load; [3] transfers orphan lookup
    const orphanWhere = findMock.mock.calls[3][0].where
    expect(orphanWhere.and).toEqual(
      expect.arrayContaining([
        { id: { in: [55] } },
        { investment: { equals: 31 } },
        {
          type: {
            in: ['INVESTOR_DEPOSIT', 'LABOR_COST', 'RABAT', 'PAYOUT', 'CORRECTION', 'LOSS'],
          },
        },
      ]),
    )
  })

  it('creates the transfers tab first when it is missing (self-heal on old sheets)', async () => {
    withSheet(31, 'sheet-1')
    findMock.mockResolvedValue({ docs: [] })
    sheetGrids([], [])
    // metadata shows only the expenses tab → ensureTab must run the full setup
    spreadsheetsGetMock.mockResolvedValue({
      data: {
        properties: { locale: 'pl_PL' },
        sheets: [{ properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })
    // setup's addSheet must surface a gid
    batchUpdateMock.mockResolvedValueOnce({
      data: { replies: [{ addSheet: { properties: { sheetId: 99 } } }] },
    })

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    const addSheetReq = batchUpdateMock.mock.calls[0][0].requestBody.requests[0]
    expect(addSheetReq).toEqual({
      addSheet: { properties: { title: 'transfery (tylko do odczytu)' } },
    })
    expect(valuesClearMock).toHaveBeenCalledTimes(1) // setup cleared only the new tab
  })
})

// ── syncSingleTransferToSheet ──────────────────────────────────────────────

describe('syncSingleTransferToSheet', () => {
  it('updates the existing row in place when the transfer is already on the sheet', async () => {
    // syncSingleTransferToSheet: findByID(transactions) → getInvestmentSheetId via find(kosztoryses).
    findByIDMock.mockResolvedValue({
      id: 101,
      type: 'INVESTMENT_EXPENSE',
      investment: 31,
      expenseCategory: { name: 'Materiały budowlane' },
      amount: 999,
      description: 'edited',
      date: '2026-05-27T00:00:00Z',
    })
    withSheet(31, 'sheet-1')
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
    // 1st findByID(transactions) = the cancellation; 2nd findByID(transactions) = the original.
    // Then getInvestmentSheetId → find(kosztoryses).
    findByIDMock.mockImplementation(({ id }: { id: number }) => {
      if (id === 2460)
        return Promise.resolve({ id: 2460, type: 'CANCELLATION', cancelledTransaction: 2459 })
      return Promise.resolve({ id: 2459, type: 'INVESTMENT_EXPENSE', investment: 31 })
    })
    withSheet(31, 'sheet-1')
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

  it('removes the row when an edited expense is no longer mappable (category cleared) — T2.4', async () => {
    findByIDMock.mockResolvedValue({
      id: 101,
      type: 'INVESTMENT_EXPENSE',
      investment: 31,
      expenseCategory: null, // cleared → expenseRow() returns undefined
      amount: 100,
      date: '2026-05-27T00:00:00Z',
    })
    withSheet(31, 'sheet-1')
    sheetColIReturns([101]) // 101 currently on row 2
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [{ properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })

    await syncSingleTransferToSheet({ transferId: 101 })

    // The stale row is deleted (data columns only); nothing is appended/updated.
    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    expect(
      batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteRange.range.startRowIndex,
    ).toBe(1)
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled()
  })
})

// ── syncSingleTransferToSheet — transfers tab routing ──────────────────────

describe('syncSingleTransferToSheet — transfers tab routing', () => {
  it('routes a PAYOUT to the transfers tab', async () => {
    findByIDMock.mockResolvedValue({
      id: 201,
      type: 'PAYOUT',
      investment: 31,
      amount: 300,
      worker: { name: 'Jan' },
      description: 'wypłata',
      date: '2026-06-01T00:00:00Z',
    })
    withSheet(31, 'sheet-1')
    sheetGrids([], []) // transfers tab empty → append at row 2

    await syncSingleTransferToSheet({ transferId: 201 })

    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
    const cells = valuesBatchUpdateMock.mock.calls[0][0].requestBody.data
    expect(cells[0].range).toBe("'transfery (tylko do odczytu)'!A2")
    expect(cells).toHaveLength(8)
    expect(cells[5].values).toEqual([['Jan']])
  })

  it('removes the original LABOR_COST row from the transfers tab when a CANCELLATION is synced', async () => {
    findByIDMock.mockImplementation(({ id }: { id: number }) => {
      if (id === 2460)
        return Promise.resolve({ id: 2460, type: 'CANCELLATION', cancelledTransaction: 2459 })
      return Promise.resolve({ id: 2459, type: 'LABOR_COST', investment: 31 })
    })
    withSheet(31, 'sheet-1')
    sheetGrids([], [2459]) // original sits on row 2 of the TRANSFERS tab

    await syncSingleTransferToSheet({ transferId: 2460 })

    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    expect(batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteRange).toEqual({
      range: {
        sheetId: 6, // transfers tab gid from BOTH_TABS_META
        startRowIndex: 1,
        endRowIndex: 2,
        startColumnIndex: 0,
        endColumnIndex: 8, // transfers tab has 8 data columns
      },
      shiftDimension: 'ROWS',
    })
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled()
  })

  it('ignores types outside the sheet-synced set', async () => {
    findByIDMock.mockResolvedValue({ id: 300, type: 'REGISTER_TRANSFER', amount: 50 })

    await syncSingleTransferToSheet({ transferId: 300 })

    expect(valuesGetMock).not.toHaveBeenCalled()
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled()
  })
})

// ── removeTransferFromSheet ────────────────────────────────────────────────

describe('removeTransferFromSheet', () => {
  it('removes the row from the given investment’s sheet', async () => {
    withSheet(31, 'sheet-old')
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

  it('no-ops when the investment has no linked kosztorys sheet', async () => {
    withSheet(31, null)
    await removeTransferFromSheet({ transferId: 55, investmentId: 31 })
    expect(valuesGetMock).not.toHaveBeenCalled()
    expect(batchUpdateMock).not.toHaveBeenCalled()
  })

  it('routes by type: a PAYOUT row is deleted from the transfers tab', async () => {
    withSheet(31, 'sheet-old')
    sheetGrids([], [55]) // id 55 on row 2 of the TRANSFERS tab

    await removeTransferFromSheet({ transferId: 55, investmentId: 31, type: 'PAYOUT' })

    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    const { range } = batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteRange
    expect(range.sheetId).toBe(6) // transfers tab gid
    expect(range.endColumnIndex).toBe(8)
  })
})
