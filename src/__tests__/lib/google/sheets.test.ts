import { describe, it, expect, vi, beforeEach } from 'vitest'

const getMock = vi.fn()
const valuesBatchUpdateMock = vi.fn()
const valuesAppendMock = vi.fn()
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
        values: { get: getMock, batchUpdate: valuesBatchUpdateMock, append: valuesAppendMock },
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
  valuesAppendMock.mockReset()
  valuesAppendMock.mockResolvedValue({ data: {} })
  spreadsheetsGetMock.mockReset()
  batchUpdateMock.mockReset()
  batchUpdateMock.mockResolvedValue({ data: {} })
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIITEST\n-----END PRIVATE KEY-----\n',
  })
})

describe('applyMaterialRowsBatch', () => {
  const TAB = "'wydatki inwestycyjne (tylko do odczytu)'"

  it('appends an id the sheet lacks via values.append (server-side row allocation)', async () => {
    getMock.mockResolvedValueOnce({ data: { values: [HEADER] } }) // header only
    const { applyMaterialRowsBatch } = await import('@/lib/google/sheets')
    const res = await applyMaterialRowsBatch('s', [
      {
        transferId: 101,
        date: '2026-05-27',
        typ: 'Materiały budowlane',
        description: 'cement',
        amount: 500,
        category: 'Łazienka',
        note: 'FV/1',
      },
    ])

    expect(res).toEqual({ added: 1, updated: 0, removed: 0 })
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled()
    expect(valuesAppendMock).toHaveBeenCalledTimes(1)
    const req = valuesAppendMock.mock.calls[0][0]
    // values.append lets Google place the row after the last non-empty data row,
    // so a manual row below the block is never overwritten (T1.4) and concurrent
    // appends can't collide on a computed row (T2.1).
    expect(req.range).toBe(`${TAB}!A:G`)
    expect(req.valueInputOption).toBe('USER_ENTERED')
    expect(req.insertDataOption).toBe('INSERT_ROWS')
    expect(req.requestBody.values).toEqual([
      [101, '2026-05-27', 'Materiały budowlane', 'cement', 500, 'Łazienka', 'FV/1'],
    ])
  })

  it('overwrites an existing id in place via batchUpdate (no append)', async () => {
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101], [102]] } }) // 102 → row 3
    const { applyMaterialRowsBatch } = await import('@/lib/google/sheets')
    const res = await applyMaterialRowsBatch('s', [
      {
        transferId: 102,
        date: '2026-05-27',
        typ: 'Materiały budowlane',
        description: 'cement',
        amount: 500,
        category: 'Łazienka',
        note: 'FV/1',
      },
    ])

    expect(res).toEqual({ added: 0, updated: 1, removed: 0 })
    expect(valuesAppendMock).not.toHaveBeenCalled()
    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data).toEqual([
      { range: `${TAB}!A3`, values: [[102]] },
      { range: `${TAB}!B3`, values: [['2026-05-27']] },
      { range: `${TAB}!C3`, values: [['Materiały budowlane']] },
      { range: `${TAB}!D3`, values: [['cement']] },
      { range: `${TAB}!E3`, values: [[500]] },
      { range: `${TAB}!F3`, values: [['Łazienka']] },
      { range: `${TAB}!G3`, values: [['FV/1']] },
    ])
  })

  it('updates present, appends missing, and removes orphans bottom-up in one batch', async () => {
    // header r1, 101 r2, 102 r3, 103 r4
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101], [102], [103]] } })
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [
          { properties: { sheetId: 777, title: 'wydatki inwestycyjne (tylko do odczytu)' } },
        ],
      },
    })
    const { applyMaterialRowsBatch } = await import('@/lib/google/sheets')
    const row = (id: number) => ({
      transferId: id,
      date: 'd',
      typ: 'Materiały budowlane',
      description: 'x',
      amount: 1,
      category: '',
      note: '',
    })
    const res = await applyMaterialRowsBatch('s', [row(102), row(200)], [101, 103])

    expect(res).toEqual({ added: 1, updated: 1, removed: 2 })
    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1) // the one update (102)
    expect(valuesAppendMock).toHaveBeenCalledTimes(1) // the one append (200)
    // deletes run bottom-up: 103 (row 4 → startRowIndex 3) before 101 (row 2 → 1)
    const reqs = batchUpdateMock.mock.calls[0][0].requestBody.requests
    expect(
      reqs.map(
        (r: { deleteRange: { range: { startRowIndex: number } } }) =>
          r.deleteRange.range.startRowIndex,
      ),
    ).toEqual([3, 1])
    expect(reqs[0].deleteRange.range.endColumnIndex).toBe(7) // summary (col H+) preserved
  })

  it('fails loud when the header row is missing required columns', async () => {
    getMock.mockResolvedValueOnce({ data: { values: [['id', 'data', 'opis']] } })
    const { applyMaterialRowsBatch } = await import('@/lib/google/sheets')
    await expect(
      applyMaterialRowsBatch('s', [
        { transferId: 1, date: 'd', typ: 't', description: 'x', amount: 1, category: '', note: '' },
      ]),
    ).rejects.toThrow(/header row not found/)
  })
})

describe('removeMaterialRow', () => {
  it('deletes only the data columns of the row, leaving the summary columns intact', async () => {
    // id 102 sits on sheet row 3 (header row 1, 101 on row 2, 102 on row 3)
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101], [102]] } })
    // tab gid lookup
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [
          { properties: { sheetId: 777, title: 'wydatki inwestycyjne (tylko do odczytu)' } },
        ],
      },
    })
    const { removeMaterialRow } = await import('@/lib/google/sheets')
    await removeMaterialRow('s', 102)

    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    // deleteRange scoped to columns [0, 7) shifts rows below up while the summary
    // block (column H = index 7 onward) is never in the deleted range — so the
    // =SUM/=SUMIF formulas on row 2 survive even when the deleted row is row 2.
    expect(batchUpdateMock.mock.calls[0][0].requestBody.requests).toEqual([
      {
        deleteRange: {
          range: {
            sheetId: 777,
            startRowIndex: 2,
            endRowIndex: 3,
            startColumnIndex: 0,
            endColumnIndex: 7,
          },
          shiftDimension: 'ROWS',
        },
      },
    ])
  })

  it('no-ops when the transferId is not on the sheet', async () => {
    getMock.mockResolvedValueOnce({ data: { values: [HEADER, [101]] } })
    const { removeMaterialRow } = await import('@/lib/google/sheets')
    await removeMaterialRow('s', 999)
    expect(spreadsheetsGetMock).not.toHaveBeenCalled()
    expect(batchUpdateMock).not.toHaveBeenCalled()
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

describe('buildMaterialySummary', () => {
  it('uses full-column ranges + literal type-name criteria (drift-proof)', async () => {
    const { buildMaterialySummary } = await import('@/lib/google/sheets')
    const { labels, totals } = buildMaterialySummary(
      ['Materiały budowlane', 'Pozostałe koszty'],
      ';',
    )
    expect(labels).toEqual(['RAZEM', 'Materiały budowlane', 'Pozostałe koszty'])
    expect(totals).toEqual([
      '=SUM(E:E)',
      '=SUMIF(C:C; "Materiały budowlane"; E:E)',
      '=SUMIF(C:C; "Pozostałe koszty"; E:E)',
    ])
    // No reference to label cells (I1/J1/…) and no C2:C — those were the drift source.
    expect(totals.join('')).not.toMatch(/[IJKL]\d/)
    expect(totals.join('')).not.toContain('C2:C')
  })

  it('honors the locale separator and escapes quotes in type names', async () => {
    const { buildMaterialySummary } = await import('@/lib/google/sheets')
    const { totals } = buildMaterialySummary(['A "B"'], ',')
    expect(totals).toEqual(['=SUM(E:E)', '=SUMIF(C:C, "A ""B""", E:E)'])
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
