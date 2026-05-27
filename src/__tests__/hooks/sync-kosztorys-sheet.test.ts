import { describe, it, expect, vi, beforeEach } from 'vitest'

// after() fires the callback immediately and we capture its (async) promise so the
// test can await the lazily-imported sync before asserting.
const hoisted = vi.hoisted(() => ({ pending: [] as Promise<unknown>[] }))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: (fn: () => unknown) => {
      hoisted.pending.push(Promise.resolve(fn()))
    },
  }
})

// The sync boundary is lazily imported inside after() — mock the module so the
// dynamic import resolves to spies.
const mockSyncSingle = vi.fn()
const mockRemoveFromSheet = vi.fn()
vi.mock('@/lib/actions/sheets-sync', () => ({
  syncSingleTransferToSheet: (...a: unknown[]) => mockSyncSingle(...a),
  removeTransferFromSheet: (...a: unknown[]) => mockRemoveFromSheet(...a),
}))

const { syncKosztorysAfterChange, syncKosztorysAfterDelete } =
  await import('@/hooks/transfers/sync-kosztorys-sheet')

// Await every after() callback the hook scheduled (each lazily imports the sync module).
const flush = () => Promise.all(hoisted.pending)

const change = async (args: object) => {
  ;(syncKosztorysAfterChange as unknown as (a: object) => unknown)({
    collection: {},
    req: {},
    operation: 'update',
    ...args,
  })
  await flush()
}
const del = async (args: object) => {
  ;(syncKosztorysAfterDelete as unknown as (a: object) => unknown)({
    collection: {},
    req: {},
    ...args,
  })
  await flush()
}

beforeEach(() => {
  mockSyncSingle.mockReset()
  mockRemoveFromSheet.mockReset()
  hoisted.pending.length = 0
})

describe('syncKosztorysAfterChange', () => {
  it('syncs an expense in place when the investment is unchanged', async () => {
    await change({ doc: { id: 10, type: 'INVESTMENT_EXPENSE', investment: 2 } })
    expect(mockSyncSingle).toHaveBeenCalledWith({ transferId: 10 })
    expect(mockRemoveFromSheet).not.toHaveBeenCalled()
  })

  it('removes from the old sheet then syncs to the new when the investment changes', async () => {
    await change({
      doc: { id: 10, type: 'INVESTMENT_EXPENSE', investment: 9 },
      previousDoc: { id: 10, type: 'INVESTMENT_EXPENSE', investment: 2 },
    })
    expect(mockRemoveFromSheet).toHaveBeenCalledWith({ transferId: 10, investmentId: 2 })
    expect(mockSyncSingle).toHaveBeenCalledWith({ transferId: 10 })
  })

  it('skips non-expense types', async () => {
    await change({ doc: { id: 10, type: 'LABOR_COST', investment: 2 } })
    expect(mockSyncSingle).not.toHaveBeenCalled()
    expect(mockRemoveFromSheet).not.toHaveBeenCalled()
  })

  it('skips when context.skipKosztorysSync is set (bulk batches its own sync)', async () => {
    await change({
      doc: { id: 10, type: 'INVESTMENT_EXPENSE', investment: 2 },
      context: { skipKosztorysSync: true },
    })
    expect(mockSyncSingle).not.toHaveBeenCalled()
  })
})

describe('syncKosztorysAfterDelete', () => {
  it('removes a deleted expense from its sheet', async () => {
    await del({ doc: { id: 10, type: 'INVESTMENT_EXPENSE', investment: 2 } })
    expect(mockRemoveFromSheet).toHaveBeenCalledWith({ transferId: 10, investmentId: 2 })
  })

  it('skips non-expense deletes', async () => {
    await del({ doc: { id: 10, type: 'CANCELLATION', investment: 2 } })
    expect(mockRemoveFromSheet).not.toHaveBeenCalled()
  })
})
