import { describe, it, expect, vi, beforeEach } from 'vitest'

const appendMock = vi.fn()
const updateMock = vi.fn()
const getMock = vi.fn()
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
        get: getMock,
        batchUpdate: batchUpdateMock,
        values: { append: appendMock, update: updateMock, get: getMock },
      },
    }),
  },
}))

beforeEach(() => {
  appendMock.mockReset()
  updateMock.mockReset()
  getMock.mockReset()
  batchUpdateMock.mockReset()
  appendMock.mockResolvedValue({ data: { updates: { updatedRange: "'materiały '!B5:C5" } } })
  updateMock.mockResolvedValue({ data: {} })
  batchUpdateMock.mockResolvedValue({ data: {} })
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIITEST\n-----END PRIVATE KEY-----\n',
  })
})

describe('appendMaterialRow', () => {
  it('writes [amount, "desc [date]"] to B:C and transferId to I for budowlane', async () => {
    const { appendMaterialRow } = await import('@/lib/google/sheets')
    const result = await appendMaterialRow('sheet-1', {
      kind: 'budowlane',
      amount: 100,
      description: 'cement',
      transferId: 2431,
      date: '2026-05-21',
    })

    expect(appendMock).toHaveBeenCalledTimes(1)
    const append = appendMock.mock.calls[0][0]
    expect(append.range).toBe("'materiały '!B:C")
    expect(append.valueInputOption).toBe('USER_ENTERED')
    expect(append.insertDataOption).toBe('INSERT_ROWS')
    expect(append.requestBody.values).toEqual([[100, 'cement [2026-05-21]']])

    expect(updateMock).toHaveBeenCalledTimes(1)
    const update = updateMock.mock.calls[0][0]
    expect(update.range).toBe("'materiały '!I5")
    expect(update.valueInputOption).toBe('RAW')
    expect(update.requestBody.values).toEqual([[2431]])

    expect(result).toEqual({ rowIndex: 5 })
  })

  it('writes to F:G for wykończeniowe', async () => {
    appendMock.mockResolvedValueOnce({
      data: { updates: { updatedRange: "'materiały '!F7:G7" } },
    })
    const { appendMaterialRow } = await import('@/lib/google/sheets')
    const result = await appendMaterialRow('sheet-2', {
      kind: 'wykończeniowe',
      amount: 250.5,
      description: 'farba',
      transferId: 99,
      date: '2026-05-21',
    })
    expect(appendMock.mock.calls[0][0].range).toBe("'materiały '!F:G")
    expect(updateMock.mock.calls[0][0].range).toBe("'materiały '!I7")
    expect(result).toEqual({ rowIndex: 7 })
  })

  it('throws when the append response is missing updatedRange', async () => {
    appendMock.mockResolvedValueOnce({ data: { updates: {} } })
    const { appendMaterialRow } = await import('@/lib/google/sheets')
    await expect(
      appendMaterialRow('sheet-3', {
        kind: 'budowlane',
        amount: 10,
        description: 'x',
        transferId: 1,
        date: '2026-05-21',
      }),
    ).rejects.toThrow(/updatedRange/)
  })
})

describe('readMaterialyTransferIds', () => {
  it('returns a Map<transferId, rowIndex>', async () => {
    getMock.mockResolvedValueOnce({
      data: { values: [[], [], [2431], [99], [], [777]] },
    })
    const { readMaterialyTransferIds } = await import('@/lib/google/sheets')
    const map = await readMaterialyTransferIds('sheet-3')
    expect(map.get(2431)).toBe(3)
    expect(map.get(99)).toBe(4)
    expect(map.get(777)).toBe(6)
    expect(map.size).toBe(3)
  })

  it('skips non-numeric and empty cells', async () => {
    getMock.mockResolvedValueOnce({
      data: { values: [[''], ['header text'], [42], [null], ['  ']] },
    })
    const { readMaterialyTransferIds } = await import('@/lib/google/sheets')
    const map = await readMaterialyTransferIds('sheet-4')
    expect(map.size).toBe(1)
    expect(map.get(42)).toBe(3)
  })

  it('returns an empty map when values is missing', async () => {
    getMock.mockResolvedValueOnce({ data: {} })
    const { readMaterialyTransferIds } = await import('@/lib/google/sheets')
    const map = await readMaterialyTransferIds('sheet-5')
    expect(map.size).toBe(0)
  })
})

describe('deleteMaterialRowByTransferId', () => {
  it('reads col I, finds the row, and deleteDimensions it', async () => {
    getMock.mockResolvedValueOnce({
      data: { sheets: [{ properties: { sheetId: 42, title: 'materiały ' } }] },
    })
    getMock.mockResolvedValueOnce({ data: { values: [[], [], [2431], [99]] } })
    const { deleteMaterialRowByTransferId } = await import('@/lib/google/sheets')
    const result = await deleteMaterialRowByTransferId('sheet-6', 2431)
    expect(result).toEqual({ deleted: true, rowIndex: 3 })
    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    const req = batchUpdateMock.mock.calls[0][0].requestBody.requests[0]
    expect(req.deleteDimension.range).toEqual({
      sheetId: 42,
      dimension: 'ROWS',
      startIndex: 2,
      endIndex: 3,
    })
  })

  it('returns { deleted: false } when transferId not found', async () => {
    getMock.mockResolvedValueOnce({
      data: { sheets: [{ properties: { sheetId: 42, title: 'materiały ' } }] },
    })
    getMock.mockResolvedValueOnce({ data: { values: [[], [], [2431]] } })
    const { deleteMaterialRowByTransferId } = await import('@/lib/google/sheets')
    const result = await deleteMaterialRowByTransferId('sheet-7', 9999)
    expect(result).toEqual({ deleted: false })
    expect(batchUpdateMock).not.toHaveBeenCalled()
  })

  it('throws when materiały tab is missing', async () => {
    getMock.mockResolvedValueOnce({
      data: { sheets: [{ properties: { sheetId: 1, title: 'kosztorys_robocizny' } }] },
    })
    const { deleteMaterialRowByTransferId } = await import('@/lib/google/sheets')
    await expect(deleteMaterialRowByTransferId('sheet-8', 1)).rejects.toThrow(/materiały tab/)
  })
})
