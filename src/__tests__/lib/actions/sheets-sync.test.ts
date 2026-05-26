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

const { previewMaterialSync, applyMaterialSync } = await import('@/lib/actions/sheets-sync')

// ── helpers ──────────────────────────────────────────────────────────────

function setEnv() {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'test@x.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n',
  })
}

// payload returns a paginated shape; we only care about `docs`.
function findReturns(docs: object[]) {
  findMock.mockResolvedValue({ docs })
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

  it('returns toAppend for DB Materiały rows that are not in the sheet', async () => {
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
    expect(result.data.toDelete).toEqual([])
    expect(result.data.orphans).toEqual([])
  })

  it('returns toDelete for rows in the sheet whose transfer exists but is excluded (e.g. cancelled)', async () => {
    findByIDMock.mockImplementation(({ collection, id }: { collection: string; id: number }) => {
      if (collection === 'investments') {
        return Promise.resolve({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
      }
      // probe finds the cancelled transaction by id — its mere existence promotes
      // the sheet row to toDelete rather than orphan.
      if (collection === 'transactions' && id === 999) {
        return Promise.resolve({ id: 999, cancelled: true })
      }
      return Promise.resolve(null)
    })
    findReturns([]) // active app rows is empty (the only relevant tx is cancelled)
    sheetColIReturns([999]) // sheet has row for transferId 999 at row 2 (after header)

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.toAppend).toEqual([])
    expect(result.data.toDelete).toEqual([{ transferId: 999, rowIndex: 2 }])
    expect(result.data.orphans).toEqual([])
  })

  it('classifies true orphans (sheet row whose transferId is not in the DB at all)', async () => {
    findByIDMock.mockImplementation(({ collection, id }: { collection: string; id: number }) => {
      if (collection === 'investments') {
        return Promise.resolve({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
      }
      if (collection === 'transactions' && id === 9999) return Promise.resolve(null)
      return Promise.resolve(null)
    })
    findReturns([])
    sheetColIReturns([9999])

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data.toAppend).toEqual([])
    expect(result.data.toDelete).toEqual([])
    expect(result.data.orphans).toEqual([{ transferIdInSheet: 9999, rowIndex: 2 }])
  })
})

// ── applyMaterialSync ────────────────────────────────────────────────────

describe('applyMaterialSync', () => {
  it('skips an append whose transferId is already present in col I', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
    sheetColIReturns([5]) // col I already has transferId 5

    const preview = {
      toAppend: [
        {
          transferId: 5,
          date: '2026-05-21',
          typ: 'Materiały budowlane',
          description: 'cement',
          amount: 100,
          category: 'Łazienka',
          note: 'FV/1',
        },
      ],
      toDelete: [],
      orphans: [],
      spreadsheetId: 'sheet-1',
    }

    const result = await applyMaterialSync(31, preview)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({ added: 0, deleted: 0, skipped: 1, errors: [] })
    expect(valuesAppendMock).not.toHaveBeenCalled()
  })

  it('refuses when the investment’s googleSheetId no longer matches the preview’s spreadsheetId', async () => {
    findByIDMock.mockResolvedValue({
      id: 31,
      name: '11 Listopada 40',
      googleSheetId: 'sheet-1-current',
    })

    const preview = {
      toAppend: [],
      toDelete: [],
      orphans: [],
      spreadsheetId: 'sheet-1-old',
    }

    const result = await applyMaterialSync(31, preview)

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/podgląd ponownie/i)
    // Refusal happens before any Google write.
    expect(valuesAppendMock).not.toHaveBeenCalled()
    expect(batchUpdateMock).not.toHaveBeenCalled()
  })
})
