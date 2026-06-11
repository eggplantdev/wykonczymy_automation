import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN CHARACTERIZATION TEST (regression lock, spec criterion 1).
// Captures the exact Google Sheets API payloads the EXPENSES tab code emits.
// The snapshot is the contract: the config-driven refactor may change function
// signatures (this file's call sites), but the captured requests must stay
// byte-identical. Do NOT update the snapshot to make a refactor pass — a diff
// here means the expenses tab output changed, which the spec forbids.
// ─────────────────────────────────────────────────────────────────────────────

const getMock = vi.fn()
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
          get: getMock,
          batchUpdate: valuesBatchUpdateMock,
          clear: valuesClearMock,
        },
      },
    }),
  },
}))

const HEADER = ['id', 'data', 'typ wydatku inwestycyjnego', 'opis', 'kwota', 'kategoria', 'notatka']

// Every captured call in order: [apiMethod, requestArg]
function captured() {
  const calls: Array<[string, unknown]> = []
  for (const [name, mock] of [
    ['spreadsheets.get', spreadsheetsGetMock],
    ['spreadsheets.batchUpdate', batchUpdateMock],
    ['values.get', getMock],
    ['values.batchUpdate', valuesBatchUpdateMock],
    ['values.clear', valuesClearMock],
  ] as const) {
    for (const call of mock.mock.calls) calls.push([name, call[0]])
  }
  return calls
}

beforeEach(() => {
  getMock.mockReset()
  valuesBatchUpdateMock.mockReset()
  valuesBatchUpdateMock.mockResolvedValue({ data: {} })
  valuesClearMock.mockReset()
  valuesClearMock.mockResolvedValue({ data: {} })
  spreadsheetsGetMock.mockReset()
  batchUpdateMock.mockReset()
  batchUpdateMock.mockResolvedValue({ data: {} })
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIITEST\n-----END PRIVATE KEY-----\n',
  })
})

describe('GOLDEN: expenses tab emitted requests', () => {
  it('setupMaterialyTab on a sheet where the tab already exists (reset path)', async () => {
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        properties: { locale: 'pl_PL' },
        sheets: [
          {
            properties: { sheetId: 777, title: 'wydatki inwestycyjne (tylko do odczytu)' },
            conditionalFormats: [{}, {}],
            protectedRanges: [{ protectedRangeId: 55 }],
            tables: [{ tableId: 'tbl-1' }],
          },
        ],
      },
    })
    const { setupTab, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')
    await setupTab('golden-sheet', EXPENSES_TAB_CONFIG, [
      'Materiały budowlane',
      'Materiały wykończeniowe',
      'Pozostałe koszty',
    ])
    expect(captured()).toMatchSnapshot()
  })

  it('setupMaterialyTab when the tab is missing (addSheet path)', async () => {
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: { properties: { locale: 'pl_PL' }, sheets: [] },
    })
    batchUpdateMock.mockResolvedValueOnce({
      data: { replies: [{ addSheet: { properties: { sheetId: 9 } } }] },
    })
    const { setupTab, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')
    await setupTab('golden-sheet', EXPENSES_TAB_CONFIG, ['Materiały budowlane'])
    expect(captured()).toMatchSnapshot()
  })

  it('applyMaterialRowsBatch: update + append + remove in one batch', async () => {
    // header r1, ids 101 r2, 102 r3, 103 r4
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101], [102], [103]] } })
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [
          { properties: { sheetId: 777, title: 'wydatki inwestycyjne (tylko do odczytu)' } },
        ],
      },
    })
    const { applyTabRowsBatch, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')
    const res = await applyTabRowsBatch(
      'golden-sheet',
      EXPENSES_TAB_CONFIG,
      [
        {
          transferId: 102,
          date: '2026-06-01',
          typ: 'Materiały budowlane',
          description: 'cement "extra"',
          amount: 1234.56,
          category: 'Łazienka',
          note: 'FV/9',
        },
        {
          transferId: 200,
          date: '2026-06-02',
          typ: 'Pozostałe koszty',
          description: 'wywóz gruzu',
          amount: 0,
          category: '',
          note: '',
        },
      ],
      [101, 103],
    )
    expect(res).toEqual({ added: 1, updated: 1, removed: 2 })
    expect(captured()).toMatchSnapshot()
  })
})
