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

const { syncSheetAfterChange, syncSheetAfterDelete } = await import('@/hooks/transfers/sync-sheet')

// Await every after() callback the hook scheduled (each lazily imports the sync module).
const flush = () => Promise.all(hoisted.pending)

const change = async (args: object) => {
  ;(syncSheetAfterChange as unknown as (a: object) => unknown)({
    collection: {},
    req: {},
    operation: 'update',
    ...args,
  })
  await flush()
}
const del = async (args: object) => {
  ;(syncSheetAfterDelete as unknown as (a: object) => unknown)({
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

describe('syncSheetAfterChange', () => {
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
    expect(mockRemoveFromSheet).toHaveBeenCalledWith({
      transferId: 10,
      investmentId: 2,
      type: 'INVESTMENT_EXPENSE',
    })
    expect(mockSyncSingle).toHaveBeenCalledWith({ transferId: 10 })
  })

  it('syncs each transfers-tab type (the six mirrored on the transfery tab)', async () => {
    const six = ['INVESTOR_DEPOSIT', 'LABOR_COST', 'RABAT', 'PAYOUT', 'CORRECTION', 'LOSS']
    for (const type of six) {
      mockSyncSingle.mockReset()
      await change({ doc: { id: 10, type, investment: 2 } })
      expect(mockSyncSingle).toHaveBeenCalledWith({ transferId: 10 })
    }
  })

  it('skips types with no sheet tab (not expenses, not one of the six)', async () => {
    for (const type of ['REGISTER_TRANSFER', 'OTHER', 'COMPANY_FUNDING', 'OTHER_DEPOSIT', 'CANCELLATION']) {
      await change({ doc: { id: 10, type, investment: 2 } })
    }
    expect(mockSyncSingle).not.toHaveBeenCalled()
    expect(mockRemoveFromSheet).not.toHaveBeenCalled()
  })

  it('skips when context.skipSheetSync is set (bulk batches its own sync)', async () => {
    await change({
      doc: { id: 10, type: 'INVESTMENT_EXPENSE', investment: 2 },
      context: { skipSheetSync: true },
    })
    expect(mockSyncSingle).not.toHaveBeenCalled()
  })
})

describe('syncSheetAfterDelete', () => {
  it('removes a deleted expense from its sheet', async () => {
    await del({ doc: { id: 10, type: 'INVESTMENT_EXPENSE', investment: 2 } })
    expect(mockRemoveFromSheet).toHaveBeenCalledWith({
      transferId: 10,
      investmentId: 2,
      type: 'INVESTMENT_EXPENSE',
    })
  })

  it('removes a deleted transfers-tab transfer from its sheet, routed by type', async () => {
    await del({ doc: { id: 11, type: 'PAYOUT', investment: 2 } })
    expect(mockRemoveFromSheet).toHaveBeenCalledWith({
      transferId: 11,
      investmentId: 2,
      type: 'PAYOUT',
    })
  })

  it('skips deletes of types with no sheet tab', async () => {
    await del({ doc: { id: 10, type: 'CANCELLATION', investment: 2 } })
    await del({ doc: { id: 12, type: 'REGISTER_TRANSFER', investment: 2 } })
    expect(mockRemoveFromSheet).not.toHaveBeenCalled()
  })
})
