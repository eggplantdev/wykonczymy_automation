import { vi } from 'vitest'
import { setGoogleCredentialEnv } from '@/__tests__/helpers/google-credentials'

// A spec wires this in with `vi.mock('googleapis', () => import('@/__tests__/helpers/sheets-api'))`.
export const valuesGetMock = vi.fn()
export const valuesAppendMock = vi.fn()
export const valuesBatchUpdateMock = vi.fn()
export const valuesClearMock = vi.fn()
export const spreadsheetsGetMock = vi.fn()
export const batchUpdateMock = vi.fn()
export const findMock = vi.fn()

export const google = {
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
        batchUpdate: valuesBatchUpdateMock,
        clear: valuesClearMock,
      },
    },
  }),
}

export const SHEET_HEADER = [
  'id',
  'data',
  'typ wydatku inwestycyjnego',
  'opis',
  'kwota',
  'kategoria',
  'notatka',
]
const TRANSFERS_HEADER = ['id', 'data', 'typ', 'opis', 'kwota', 'pracownik', 'kategoria', 'notatka']

// All three app-managed tabs present, so ensureTab() no-ops instead of running a full setup.
const BOTH_TABS_META = {
  data: {
    sheets: [
      { properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } },
      { properties: { sheetId: 6, title: 'transfery (tylko do odczytu)' } },
      { properties: { sheetId: 7, title: 'rozliczone R+M (tylko do odczytu)' } },
    ],
  },
}

export function resetSheetsApi() {
  valuesGetMock.mockReset()
  valuesAppendMock.mockReset()
  valuesBatchUpdateMock.mockReset()
  valuesBatchUpdateMock.mockResolvedValue({ data: {} })
  valuesClearMock.mockReset()
  valuesClearMock.mockResolvedValue({ data: {} })
  spreadsheetsGetMock.mockReset()
  spreadsheetsGetMock.mockResolvedValue(BOTH_TABS_META)
  batchUpdateMock.mockReset()
  findMock.mockReset()
  setGoogleCredentialEnv()
}

export function withSheet(investmentId: number, googleSheetId: string | null) {
  findMock.mockResolvedValueOnce({
    docs: googleSheetId ? [{ id: 1, googleSheetId, investment: investmentId }] : [],
  })
}

export const writeData = (tabPrefix: string) =>
  valuesBatchUpdateMock.mock.calls.find((c) =>
    String(c[0].requestBody.data[0].range).startsWith(tabPrefix),
  )?.[0].requestBody.data

// We prepend the header, so transferId i lands on sheet row i+2.
export function sheetGrids(
  expenseIds: Array<number | null>,
  transferIds: Array<number | null> = [],
  settledIds: Array<number | null> = [],
) {
  const grid = (header: string[], ids: Array<number | null>) => ({
    data: { values: [header, ...ids.map((id) => (id === null ? [] : [id]))] },
  })
  valuesGetMock.mockImplementation(({ range }: { range: string }) =>
    Promise.resolve(
      range.startsWith("'transfery")
        ? grid(TRANSFERS_HEADER, transferIds)
        : range.startsWith("'rozliczone")
          ? grid(SHEET_HEADER, settledIds)
          : grid(SHEET_HEADER, expenseIds),
    ),
  )
}
