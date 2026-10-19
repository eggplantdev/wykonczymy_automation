import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import type { MaterialSyncPreviewT } from '@/lib/actions/sheets-sync'
import { activeInvestmentExecute } from '@/__tests__/helpers/transfer-hook-args'
import {
  SHEET_HEADER,
  batchUpdateMock,
  findMock,
  resetSheetsApi,
  sheetGrids,
  spreadsheetsGetMock,
  valuesAppendMock,
  valuesBatchUpdateMock,
  valuesClearMock,
  valuesGetMock,
  withSheet,
  writeData,
} from '@/__tests__/helpers/sheets-api'

vi.mock('googleapis', () => import('@/__tests__/helpers/sheets-api'))

const mockPayload = {
  find: findMock,
  // The completed-investment lock reads the status through the drizzle adapter, so the double needs
  // one — „aktywna", since the lock has its own spec and the sync is the subject here.
  db: { drizzle: { execute: activeInvestmentExecute } },
} as unknown as Payload

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn().mockResolvedValue(mockPayload),
  }
})

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const { previewMaterialSync, applyMaterialSync } = await import('@/lib/actions/sheets-sync')

function findReturns(expenses: object[]) {
  findMock.mockResolvedValueOnce({ docs: expenses }).mockResolvedValue({ docs: [] })
}

// Route a Payload find by collection + where-clause, INDEPENDENT of call order — the three tab
// reconciles run concurrently (Promise.all) and interleave their loads/orphan-lookups.
function routeFinds(
  opts: {
    expenses?: object[]
    settled?: object[]
    transfers?: object[]
    orphans?: Array<{ id: number }>
    categories?: object[]
  } = {},
) {
  const { expenses = [], settled = [], transfers = [], orphans = [], categories = [] } = opts
  findMock.mockImplementation(
    ({
      collection,
      where,
    }: {
      collection: string
      where?: { and?: Array<Record<string, unknown>> }
    }) => {
      if (collection === 'kosztoryses')
        return Promise.resolve({ docs: [{ id: 1, googleSheetId: 'sheet-1', investment: 31 }] })
      if (collection === 'expense-categories') return Promise.resolve({ docs: categories })
      const and = where?.and ?? []
      const idFilter = and.find((c) => 'id' in c)
      if (idFilter) {
        const ids = (idFilter.id as { in?: number[] }).in ?? []
        return Promise.resolve({ docs: orphans.filter((o) => ids.includes(o.id)) })
      }
      const types = (and.find((c) => 'type' in c)?.type as { in?: string[] })?.in ?? []
      if (types.includes('PAYOUT')) return Promise.resolve({ docs: transfers })
      if (types.includes('INVESTMENT_EXPENSE'))
        return Promise.resolve({ docs: and.some((c) => 'settled' in c) ? settled : expenses })
      return Promise.resolve({ docs: [] })
    },
  )
}

const orphanFindCall = () =>
  findMock.mock.calls.find((c) => (c[0].where?.and ?? []).some((x: object) => 'id' in x))?.[0]

function tabOf(data: MaterialSyncPreviewT, label: string) {
  const t = data.tabs.find((x) => x.label === label)
  if (!t) throw new Error(`no preview tab "${label}"`)
  return t
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
  resetSheetsApi()
})

describe('previewMaterialSync', () => {
  it('rejects when investment has no linked kosztorys sheet', async () => {
    withSheet(31, null)

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/kosztorysu/i)
    expect(valuesGetMock).not.toHaveBeenCalled()
  })

  it('returns toAppend for DB expenses that are not in the sheet', async () => {
    withSheet(31, 'sheet-1')
    findReturns([
      makeMaterialTransaction(101, 'Materiały budowlane', { amount: 250, description: 'cement' }),
      makeMaterialTransaction(102, 'Materiały wykończeniowe', { amount: 80, description: 'farba' }),
    ])
    sheetGrids([]) // empty sheet

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(tabOf(result.data, 'Wydatki').toAppend).toHaveLength(2)
    expect(
      tabOf(result.data, 'Wydatki')
        .toAppend.map((r) => r.transferId)
        .sort(),
    ).toEqual([101, 102])
  })

  it('queries only non-cancelled investment expenses', async () => {
    withSheet(31, 'sheet-1')
    findReturns([])
    sheetGrids([])

    await previewMaterialSync(31)

    const whereArg = findMock.mock.calls[1][0].where
    expect(whereArg.and).toEqual(expect.arrayContaining([{ cancelled: { not_equals: true } }]))
  })

  it('reads an open-ended range and fetches all expenses (no row cap)', async () => {
    withSheet(31, 'sheet-1')
    findReturns([])
    sheetGrids([])

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
    sheetGrids([]) // empty sheet

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(tabOf(result.data, 'Wydatki').toAppend.map((r) => r.transferId)).toEqual([101])
  })

  it('reports update and remove counts, not just appends (T3.1)', async () => {
    withSheet(31, 'sheet-1')
    findMock
      .mockResolvedValueOnce({
        docs: [
          makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 }),
          makeMaterialTransaction(9, 'Materiały budowlane', { amount: 50 }),
        ],
      })
      .mockResolvedValueOnce({ docs: [{ id: 8 }] })
      .mockResolvedValue({ docs: [] })
    sheetGrids([7, 8])

    const result = await previewMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(tabOf(result.data, 'Wydatki').toAppend.map((r) => r.transferId)).toEqual([9])
    expect(tabOf(result.data, 'Wydatki').toUpdateCount).toBe(1) // #7 present → refreshed
    expect(tabOf(result.data, 'Wydatki').toRemoveCount).toBe(1) // #8 orphan → removed
  })

  it('previews the transfers tab, treating a MISSING tab as all-appends (no throw)', async () => {
    withSheet(31, 'sheet-1')
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
    expect(tabOf(result.data, 'Transfery').toAppend.map((r) => r.transferId)).toEqual([20])
    expect(tabOf(result.data, 'Transfery').toUpdateCount).toBe(0)
    expect(tabOf(result.data, 'Transfery').toRemoveCount).toBe(0)
  })
})

describe('applyMaterialSync', () => {
  it('rejects when investment has no linked kosztorys sheet', async () => {
    withSheet(31, null)

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(false)
    if (result.success) throw new Error('expected failure')
    expect(result.error).toMatch(/kosztorysu/i)
    expect(valuesBatchUpdateMock).not.toHaveBeenCalled()
  })

  it('appends an expense that the DB has but the sheet is missing', async () => {
    routeFinds({
      expenses: [
        makeMaterialTransaction(7, 'Materiały budowlane', { amount: 250, description: 'cement' }),
      ],
    })
    sheetGrids([]) // empty sheet

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
    routeFinds({
      expenses: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })],
      orphans: [{ id: 8 }],
    })
    sheetGrids([7, 8, 9999])

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({ added: 0, updated: 1, removed: 1, errors: [] })
    expect(batchUpdateMock).toHaveBeenCalledTimes(1)
    expect(
      batchUpdateMock.mock.calls[0][0].requestBody.requests[0].deleteRange.range.startRowIndex,
    ).toBe(2)
  })

  it('scopes the orphan-removal guard to this investment and INVESTMENT_EXPENSE', async () => {
    routeFinds({ expenses: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })] })
    sheetGrids([7, 8])

    await applyMaterialSync(31)

    // The orphan lookup must filter by id + investment + type, NOT id alone — otherwise a
    // manual number colliding with an unrelated transaction id is deleted.
    const orphanWhere = orphanFindCall()?.where
    expect(orphanWhere.and).toEqual(
      expect.arrayContaining([
        { id: { in: [8] } },
        { investment: { equals: 31 } },
        { type: { in: ['INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET', 'CORRECTION'] } },
      ]),
    )
  })
})

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
    routeFinds({
      expenses: [makeMaterialTransaction(7, 'Materiały budowlane', { amount: 100 })],
      transfers: [makeTransfer(20, 'PAYOUT', { amount: 300, worker: { name: 'Jan' } })],
    })
    sheetGrids([7], [])

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({ added: 1, updated: 1, removed: 0, errors: [] })
    expect(valuesBatchUpdateMock).toHaveBeenCalledTimes(2)
    expect(writeData("'wydatki")?.[0].range).toBe("'wydatki inwestycyjne (tylko do odczytu)'!A2")
    const transferCells = writeData("'transfery")
    expect(transferCells?.[0].range).toBe("'transfery (tylko do odczytu)'!A2")
    expect(transferCells).toHaveLength(8) // 8 mapped columns incl. pracownik
    expect(transferCells?.[2].values).toEqual([['Wypłata']]) // typ = PL label
    expect(transferCells?.[5].values).toEqual([['Jan']]) // F = pracownik
  })

  it('scopes the transfers orphan guard to this investment and the five types', async () => {
    routeFinds()
    sheetGrids([], [55])

    await applyMaterialSync(31)

    const orphanWhere = orphanFindCall()?.where
    expect(orphanWhere.and).toEqual(
      expect.arrayContaining([
        { id: { in: [55] } },
        { investment: { equals: 31 } },
        {
          type: {
            in: ['INVESTOR_DEPOSIT', 'LABOR_COST', 'RABAT', 'PAYOUT', 'LOSS'],
          },
        },
      ]),
    )
  })

  it('creates the missing transfers AND rozliczone tabs (self-heal on old sheets)', async () => {
    withSheet(31, 'sheet-1')
    findMock.mockResolvedValue({ docs: [] })
    sheetGrids([], [])
    spreadsheetsGetMock.mockResolvedValue({
      data: {
        properties: { locale: 'pl_PL' },
        sheets: [{ properties: { sheetId: 5, title: 'wydatki inwestycyjne (tylko do odczytu)' } }],
      },
    })
    batchUpdateMock.mockImplementation((req: { requestBody?: { requests?: unknown[] } }) =>
      Promise.resolve(
        (req?.requestBody?.requests?.[0] as { addSheet?: unknown })?.addSheet
          ? { data: { replies: [{ addSheet: { properties: { sheetId: 99 } } }] } }
          : { data: {} },
      ),
    )

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    const addSheetTitles = batchUpdateMock.mock.calls
      .map(
        (c) =>
          (c[0].requestBody.requests?.[0] as { addSheet?: { properties?: { title?: string } } })
            ?.addSheet?.properties?.title,
      )
      .filter(Boolean)
    expect(addSheetTitles.slice().sort()).toEqual([
      'rozliczone R+M (tylko do odczytu)',
      'transfery (tylko do odczytu)',
    ])
    expect(valuesClearMock).toHaveBeenCalledTimes(2) // one clear per newly-built tab
  })
})

describe('applyMaterialSync — rozliczone R+M tab', () => {
  it('applyMaterialSync reconciles the rozliczone tab: a settled expense appends at its real amount', async () => {
    const settledDoc = {
      id: 90,
      type: 'INVESTMENT_EXPENSE',
      investment: 31,
      settled: true,
      expenseCategory: { name: 'Materiały budowlane' },
      amount: 400,
      description: 'płytki',
      date: '2026-06-01T00:00:00Z',
    }
    routeFinds({ expenses: [settledDoc], settled: [settledDoc] })
    sheetGrids([], [], []) // all tabs empty

    const result = await applyMaterialSync(31)

    expect(result.success).toBe(true)
    const settledWrite = valuesBatchUpdateMock.mock.calls.find((c) =>
      String(c[0].requestBody.data[0].range).startsWith("'rozliczone"),
    )?.[0].requestBody.data
    expect(settledWrite?.[2].values).toEqual([['Materiały budowlane']]) // plain type
    expect(settledWrite?.[4].values).toEqual([[400]]) // real amount, not 0
  })
})
