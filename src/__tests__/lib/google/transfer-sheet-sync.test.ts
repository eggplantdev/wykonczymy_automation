import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import {
  batchUpdateMock,
  findMock,
  resetSheetsApi,
  sheetGrids,
  spreadsheetsGetMock,
  valuesBatchUpdateMock,
  valuesGetMock,
  withSheet,
  writeData,
} from '@/__tests__/helpers/sheets-api'

vi.mock('googleapis', () => import('@/__tests__/helpers/sheets-api'))

const findByIDMock = vi.fn()

const mockPayload = { find: findMock, findByID: findByIDMock } as unknown as Payload

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn().mockResolvedValue(mockPayload),
  }
})

const { syncSingleTransferToSheet, removeTransferFromSheet } =
  await import('@/lib/google/transfer-sheet-sync')

beforeEach(() => {
  resetSheetsApi()
  findByIDMock.mockReset()
})

describe('syncSingleTransferToSheet', () => {
  it('updates the existing row in place when the transfer is already on the sheet', async () => {
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
    sheetGrids([101]) // id already present → row 2

    await syncSingleTransferToSheet({ transferId: 101 })

    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(1)
    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[0].range).toBe(
      "'wydatki inwestycyjne (tylko do odczytu)'!A2",
    )
    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[4].values).toEqual([[999]])
  })

  it('removes the original expense row from its sheet when a CANCELLATION is synced', async () => {
    findByIDMock.mockImplementation(({ id }: { id: number }) => {
      if (id === 2460)
        return Promise.resolve({ id: 2460, type: 'CANCELLATION', cancelledTransaction: 2459 })
      return Promise.resolve({ id: 2459, type: 'INVESTMENT_EXPENSE', investment: 31 })
    })
    withSheet(31, 'sheet-1')
    sheetGrids([2459]) // original sits on row 2 of the sheet
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [{ properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })

    await syncSingleTransferToSheet({ transferId: 2460 })

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
    sheetGrids([101]) // 101 currently on row 2
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [{ properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })

    await syncSingleTransferToSheet({ transferId: 101 })

    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    expect(
      batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteRange.range.startRowIndex,
    ).toBe(1)
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled()
  })
})

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

describe('removeTransferFromSheet', () => {
  it('removes the row from the given investment’s sheet', async () => {
    withSheet(31, 'sheet-old')
    sheetGrids([55]) // id 55 on row 2 of the old sheet
    spreadsheetsGetMock.mockResolvedValueOnce({
      data: {
        sheets: [{ properties: { sheetId: 12, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })

    await removeTransferFromSheet({ transferId: 55, investmentId: 31, type: 'INVESTMENT_EXPENSE' })

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
    await removeTransferFromSheet({ transferId: 55, investmentId: 31, type: 'INVESTMENT_EXPENSE' })
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

  it('removes an expense row from BOTH the bill and rozliczone tabs', async () => {
    withSheet(31, 'sheet-old')
    sheetGrids([55], [], [55]) // id 55 present on bill AND rozliczone tabs

    await removeTransferFromSheet({ transferId: 55, investmentId: 31, type: 'INVESTMENT_EXPENSE' })

    const deletedGids = batchUpdateMock.mock.calls.map(
      (c) => c[0].requestBody.requests[0].deleteRange.range.sheetId,
    )
    expect(deletedGids.sort()).toEqual([5, 7])
  })
})

describe('rozliczone R+M tab — settled expense routing', () => {
  const BILL = "'wydatki inwestycyjne (tylko do odczytu)'"
  const SETTLED = "'rozliczone R+M (tylko do odczytu)'"

  it('a settled expense lands on BOTH tabs: bill at kwota 0 + "rozliczone", rozliczone at real amount', async () => {
    findByIDMock.mockResolvedValue({
      id: 70,
      type: 'INVESTMENT_EXPENSE',
      investment: 31,
      settled: true,
      expenseCategory: { name: 'Materiały budowlane' },
      amount: 250,
      description: 'cement',
      date: '2026-06-01T00:00:00Z',
    })
    withSheet(31, 'sheet-1')
    findMock.mockResolvedValue({ docs: [] }) // SETTLED ensure → expense-categories lookup
    sheetGrids([], [], []) // both tabs empty → append at row 2

    await syncSingleTransferToSheet({ transferId: 70 })

    const bill = writeData(BILL)
    const settled = writeData(SETTLED)
    expect(bill?.[2].values).toEqual([['Materiały budowlane rozliczone']]) // C = typ
    expect(bill?.[4].values).toEqual([[0]]) // E = kwota → 0, off the client bill
    expect(settled?.[2].values).toEqual([['Materiały budowlane']]) // plain type on the tab
    expect(settled?.[4].values).toEqual([[250]]) // real amount
  })

  it('toggling a settled expense back to normal removes its row from the rozliczone tab', async () => {
    findByIDMock.mockResolvedValue({
      id: 70,
      type: 'INVESTMENT_EXPENSE',
      investment: 31,
      settled: false, // toggled off
      expenseCategory: { name: 'Materiały budowlane' },
      amount: 250,
      description: 'cement',
      date: '2026-06-01T00:00:00Z',
    })
    withSheet(31, 'sheet-1')
    sheetGrids([70], [], [70]) // present on both tabs from when it was settled

    await syncSingleTransferToSheet({ transferId: 70 })

    expect(valuesBatchUpdateMock.mock.calls[0][0].requestBody.data[0].range).toBe(`${BILL}!A2`)
    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    expect(batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteRange.range.sheetId).toBe(
      7, // rozliczone tab gid
    )
  })

  it('cancelling a settled expense removes it from BOTH tabs', async () => {
    findByIDMock.mockImplementation(({ id }: { id: number }) =>
      id === 80
        ? Promise.resolve({ id: 80, type: 'CANCELLATION', cancelledTransaction: 70 })
        : Promise.resolve({ id: 70, type: 'INVESTMENT_EXPENSE', investment: 31, settled: true }),
    )
    withSheet(31, 'sheet-1')
    sheetGrids([70], [], [70]) // present on both tabs

    await syncSingleTransferToSheet({ transferId: 80 })

    const deletedGids = batchUpdateMock.mock.calls.map(
      (c) => c[0].requestBody.requests[0].deleteRange.range.sheetId,
    )
    expect(deletedGids.sort()).toEqual([5, 7]) // bill + rozliczone
  })
})
