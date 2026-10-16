import { describe, it, expect, vi, beforeEach } from 'vitest'
import { READER_CREDENTIAL, WRITER_CREDENTIAL } from '@/__tests__/helpers/google-credentials'

const valuesGetMock = vi.fn()
const valuesBatchUpdateMock = vi.fn()
const valuesAppendMock = vi.fn()
const valuesClearMock = vi.fn()
const spreadsheetsGetMock = vi.fn()
const batchUpdateMock = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(function (this: object, opts: { email: string }) {
        Object.assign(this, opts)
        return this
      }),
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: {
        get: spreadsheetsGetMock,
        batchUpdate: batchUpdateMock,
        values: {
          get: valuesGetMock,
          batchUpdate: valuesBatchUpdateMock,
          append: valuesAppendMock,
          clear: valuesClearMock,
        },
      },
    }),
  },
}))

const SHEET = '152HYswm1ESgQxbk8rMt9JSeX1R-ppj49rbcZZtyCNBs'
const HEADER = ['id', 'data', 'typ', 'opis', 'kwota', 'kategoria', 'notatka']

const READER_JSON = JSON.stringify(READER_CREDENTIAL)
const WRITER_JSON = JSON.stringify(WRITER_CREDENTIAL)

const everyApiMock = [
  valuesGetMock,
  valuesBatchUpdateMock,
  valuesAppendMock,
  valuesClearMock,
  spreadsheetsGetMock,
  batchUpdateMock,
]

const ROW = {
  transferId: 102,
  date: '2026-06-01',
  typ: 'Materiały budowlane',
  description: 'x',
  amount: 100,
}

beforeEach(() => {
  for (const mock of everyApiMock) mock.mockReset()
  valuesGetMock.mockResolvedValue({ data: { values: [HEADER] } })
  valuesBatchUpdateMock.mockResolvedValue({ data: {} })
  valuesAppendMock.mockResolvedValue({ data: {} })
  valuesClearMock.mockResolvedValue({ data: {} })
  spreadsheetsGetMock.mockResolvedValue({ data: { properties: { locale: 'pl_PL' }, sheets: [] } })
  batchUpdateMock.mockResolvedValue({
    data: { replies: [{ addSheet: { properties: { sheetId: 99 } } }] },
  })
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = READER_JSON
  delete process.env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON
  delete process.env.VERCEL_ENV
})

describe('writes need the Editor credential', () => {
  it('applyTabRowsBatch throws and issues no API call when it is absent', async () => {
    const { applyTabRowsBatch, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(applyTabRowsBatch(SHEET, EXPENSES_TAB_CONFIG, [ROW])).rejects.toThrow(
      'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON',
    )

    for (const mock of everyApiMock) expect(mock).not.toHaveBeenCalled()
  })

  it('setupTab throws and issues no API call when it is absent', async () => {
    const { setupTab, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(setupTab(SHEET, EXPENSES_TAB_CONFIG, [])).rejects.toThrow(
      'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON',
    )

    for (const mock of everyApiMock) expect(mock).not.toHaveBeenCalled()
  })

  it('stays shut when VERCEL_ENV claims production but no credential is present', async () => {
    process.env.VERCEL_ENV = 'production'
    const { applyTabRowsBatch, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(applyTabRowsBatch(SHEET, EXPENSES_TAB_CONFIG, [ROW])).rejects.toThrow(
      'GOOGLE_SERVICE_ACCOUNT_WRITE_JSON',
    )
    for (const mock of everyApiMock) expect(mock).not.toHaveBeenCalled()
  })

  it('writes with the Editor credential, never the reader one', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_WRITE_JSON = WRITER_JSON
    const { google } = await import('googleapis')
    const { applyTabRowsBatch, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(applyTabRowsBatch(SHEET, EXPENSES_TAB_CONFIG, [ROW])).resolves.toEqual({
      added: 1,
      updated: 0,
      removed: 0,
    })

    // The batch reads the grid before it writes, and that read goes through the SAME client — so a
    // sheet shared with only the Editor still syncs.
    const byScope = vi
      .mocked(google.auth.JWT)
      .mock.calls.map((call) => [call[0]?.scopes?.[0], call[0]?.email])
    expect(byScope).toEqual([
      ['https://www.googleapis.com/auth/spreadsheets', WRITER_CREDENTIAL.client_email],
    ])
  })

  it('leaves reading open with no Editor credential at all', async () => {
    const { readTabTransferIds, EXPENSES_TAB_CONFIG } = await import('@/lib/google/sheets')

    await expect(readTabTransferIds(SHEET, EXPENSES_TAB_CONFIG)).resolves.toEqual(new Map())
    expect(valuesGetMock).toHaveBeenCalled()
  })
})
