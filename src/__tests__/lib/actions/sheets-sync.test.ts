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

// loadAppMaterialRows queries twice: expenses first, then cancellations (only if
// there were expenses). First call returns the expenses; later calls default to
// empty unless cancellations are provided.
function findReturns(expenses: object[], cancellations: object[] = []) {
  findMock.mockResolvedValueOnce({ docs: expenses }).mockResolvedValue({ docs: cancellations })
}

function makeCancellation(id: number, cancelledTransactionId: number) {
  return {
    id,
    type: 'CANCELLATION',
    cancelledTransaction: cancelledTransactionId,
    date: '2026-05-22T00:00:00Z',
  }
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

  it('includes a cancellation as a negative reversing row', async () => {
    findByIDMock.mockResolvedValue({ id: 31, name: '11 Listopada 40', googleSheetId: 'sheet-1' })
    findReturns(
      [makeMaterialTransaction(101, 'Materiały budowlane', { amount: 250, description: 'cement' })],
      [makeCancellation(201, 101)],
    )
    sheetColIReturns([]) // empty sheet

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    const byId = Object.fromEntries(result.data.toAppend.map((r) => [r.transferId, r]))
    expect(byId[101].amount).toBe(250)
    expect(byId[201].amount).toBe(-250) // reverses the original
    expect(byId[201].typ).toBe('Materiały budowlane') // same type as the original
    expect(byId[201].description).toBe('Anulowanie #101')
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
      spreadsheetId: 'sheet-1',
    }

    const result = await applyMaterialSync(31, preview)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({ added: 0, skipped: 1, errors: [] })
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled()
  })

  it('refuses when the investment’s googleSheetId no longer matches the preview’s spreadsheetId', async () => {
    findByIDMock.mockResolvedValue({
      id: 31,
      name: '11 Listopada 40',
      googleSheetId: 'sheet-1-current',
    })

    const preview = {
      toAppend: [],
      spreadsheetId: 'sheet-1-old',
    }

    const result = await applyMaterialSync(31, preview)

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/podgląd ponownie/i)
    // Refusal happens before any Google write.
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled()
  })
})
