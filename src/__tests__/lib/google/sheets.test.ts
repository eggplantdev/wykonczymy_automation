import { describe, it, expect, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const valuesBatchUpdateMock = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn().mockImplementation(function (this: object) {
        return this
      }),
    },
    sheets: vi.fn().mockReturnValue({
      spreadsheets: {
        values: { get: getMock, batchUpdate: valuesBatchUpdateMock },
      },
    }),
  },
}))

// Header row the code locates fields in (note: "typ wydatku inwestycyjnego"
// still matches the "typ" keyword; trailing space / casing are normalized away).
const HEADER = ['id', 'data', 'typ wydatku inwestycyjnego', 'opis', 'kwota', 'kategoria', 'notatka']

beforeEach(() => {
  getMock.mockReset()
  valuesBatchUpdateMock.mockReset()
  valuesBatchUpdateMock.mockResolvedValue({ data: {} })
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIITEST\n-----END PRIVATE KEY-----\n',
  })
})

describe('appendMaterialRow', () => {
  it('writes the seven mapped fields at the next empty row', async () => {
    getMock.mockResolvedValueOnce({ data: { values: [HEADER] } }) // header only → next row 2
    const { appendMaterialRow } = await import('@/lib/google/sheets')
    const result = await appendMaterialRow('s', {
      transferId: 101,
      date: '2026-05-27',
      typ: 'Materiały budowlane',
      description: 'cement',
      amount: 500,
      category: 'Łazienka',
      note: 'FV/1',
    })

    expect(result).toEqual({ rowIndex: 2 })
    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
    const req = valuesBatchUpdateMock.mock.calls[0][0]
    expect(req.requestBody.valueInputOption).toBe('USER_ENTERED')
    expect(req.requestBody.data).toEqual([
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!A2", values: [[101]] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!B2", values: [['2026-05-27']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!C2", values: [['Materiały budowlane']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!D2", values: [['cement']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!E2", values: [[500]] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!F2", values: [['Łazienka']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!G2", values: [['FV/1']] },
    ])
  })

  it('appends after the last id row', async () => {
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101], [102]] } })
    const { appendMaterialRow } = await import('@/lib/google/sheets')
    const result = await appendMaterialRow('s', {
      transferId: 103,
      date: 'd',
      typ: 'Pozostałe koszty',
      description: 'x',
      amount: 1,
      category: '',
      note: '',
    })
    expect(result).toEqual({ rowIndex: 4 })
    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[0].range).toBe(
      "'wydatki inwestycyjne (tylko do odczytu)'!A4",
    )
  })

  it('fails loud when the header row is missing required columns', async () => {
    getMock.mockResolvedValueOnce({ data: { values: [['id', 'data', 'opis']] } })
    const { appendMaterialRow } = await import('@/lib/google/sheets')
    await expect(
      appendMaterialRow('s', {
        transferId: 1,
        date: 'd',
        typ: 't',
        description: 'x',
        amount: 1,
        category: '',
        note: '',
      }),
    ).rejects.toThrow(/header row not found/)
  })
})

describe('updateMaterialRow', () => {
  it('writes the seven mapped fields at the given row, leaving other rows untouched', async () => {
    // grid is read to resolve header columns; row 3 is the target
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101], [102]] } })
    const { updateMaterialRow } = await import('@/lib/google/sheets')
    await updateMaterialRow('s', 3, {
      transferId: 102,
      date: '2026-05-27',
      typ: 'Materiały budowlane',
      description: 'cement',
      amount: 500,
      category: 'Łazienka',
      note: 'FV/1',
    })

    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
    const req = valuesBatchUpdateMock.mock.calls[0][0]
    expect(req.requestBody.valueInputOption).toBe('USER_ENTERED')
    expect(req.requestBody.data).toEqual([
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!A3", values: [[102]] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!B3", values: [['2026-05-27']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!C3", values: [['Materiały budowlane']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!D3", values: [['cement']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!E3", values: [[500]] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!F3", values: [['Łazienka']] },
      { range: "'wydatki inwestycyjne (tylko do odczytu)'!G3", values: [['FV/1']] },
    ])
  })
})

describe('formulaArgSeparator', () => {
  it("uses ';' for comma-decimal locales (pl_PL, de_DE)", async () => {
    const { formulaArgSeparator } = await import('@/lib/google/sheets')
    expect(formulaArgSeparator('pl_PL')).toBe(';')
    expect(formulaArgSeparator('de_DE')).toBe(';')
  })

  it("uses ',' for period-decimal locales (en_US, en_GB)", async () => {
    const { formulaArgSeparator } = await import('@/lib/google/sheets')
    expect(formulaArgSeparator('en_US')).toBe(',')
    expect(formulaArgSeparator('en_GB')).toBe(',')
  })

  it("defaults to ';' for an unknown/empty locale", async () => {
    const { formulaArgSeparator } = await import('@/lib/google/sheets')
    expect(formulaArgSeparator(undefined)).toBe(';')
    expect(formulaArgSeparator('')).toBe(';')
  })
})

describe('readMaterialyTransferIds', () => {
  it('maps transferId → row from the id column under the header', async () => {
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101], [102], [], [103]] } })
    const { readMaterialyTransferIds } = await import('@/lib/google/sheets')
    const map = await readMaterialyTransferIds('s')
    expect(map.get(101)).toBe(2)
    expect(map.get(102)).toBe(3)
    expect(map.get(103)).toBe(5)
    expect(map.size).toBe(3)
  })

  it('locates the header even with a summary block above it', async () => {
    getMock.mockResolvedValueOnce({
      data: { values: [['PODSUMOWANIE'], ['RAZEM', 800], [], HEADER, [101]] },
    })
    const { readMaterialyTransferIds } = await import('@/lib/google/sheets')
    const map = await readMaterialyTransferIds('s')
    expect(map.get(101)).toBe(5) // header at row 4, data at row 5
    expect(map.size).toBe(1)
  })
})
