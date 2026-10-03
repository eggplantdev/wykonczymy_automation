import { describe, it, expect } from 'vitest'

import {
  buildTransferLookups,
  mapTransferRow,
  type TransferDocT,
  type TransferLookupsT,
} from '@/lib/queries/transfer-mapping'
import type { MediaInfoT } from '@/lib/queries/media'

const media = (id: number): [number, MediaInfoT] => [
  id,
  { url: `/api/media/file/p${id}.jpg`, filename: `p${id}.jpg`, mimeType: 'image/jpeg' },
]

const mediaMap = new Map<number, MediaInfoT>([media(11), media(22), media(33)])

const emptyLookups = (): TransferLookupsT => ({
  cashRegisters: new Map(),
  trashedCashRegisterIds: new Set(),
  investments: new Map(),
  users: new Map(),
  expenseCategories: new Map(),
  otherCategories: new Map(),
  media: mediaMap,
})

const doc = (invoice: TransferDocT['invoice']): TransferDocT => ({
  id: 1,
  amount: 100,
  type: 'INVESTMENT_EXPENSE',
  paymentMethod: 'CASH',
  date: '2026-08-10',
  createdAt: '2026-08-10',
  invoice,
})

describe('mapTransferRow', () => {
  it('maps a row booked without a method to null, not to a label', () => {
    const row = mapTransferRow({ ...doc([]), paymentMethod: undefined }, emptyLookups())

    expect(row.paymentMethod).toBeNull()
  })

  it('carries every page onto the row', () => {
    const row = mapTransferRow(doc([11, 22]), emptyLookups())

    expect(row.invoices).toEqual([
      { id: 11, url: '/api/media/file/p11.jpg', filename: 'p11.jpg', mimeType: 'image/jpeg' },
      { id: 22, url: '/api/media/file/p22.jpg', filename: 'p22.jpg', mimeType: 'image/jpeg' },
    ])
  })

  it('leaves the list empty when no invoice is attached', () => {
    expect(mapTransferRow(doc(null), emptyLookups()).invoices).toEqual([])
  })
})

// The ref data hands pickers the live kasy only, so the name map is the one reader that has to put
// the trashed ones back — or a cancelled row on a trashed kasa loses its name to „—".
describe('buildTransferLookups — a trashed kasa', () => {
  const lookups = buildTransferLookups(
    {
      cashRegisters: [{ id: 1, name: 'Kasa główna', type: 'MAIN' }],
      trashedCashRegisters: [{ id: 2, name: 'Kasa w koszu', type: 'AUXILIARY' }],
      trashedInvestments: [],
      investments: [],
      workers: [],
      trashedWorkers: [],
      otherCategories: [],
      expenseCategories: [],
    },
    mediaMap,
  )

  it('keeps its name on the row and flags it', () => {
    const row = mapTransferRow({ ...doc([]), sourceRegister: 2, cancelled: true }, lookups)

    expect(row.sourceRegisterName).toBe('Kasa w koszu')
    expect(row.sourceRegisterTrashed).toBe(true)
  })

  it('leaves a live kasa unflagged', () => {
    const row = mapTransferRow({ ...doc([]), sourceRegister: 1, targetRegister: 2 }, lookups)

    expect(row.sourceRegisterName).toBe('Kasa główna')
    expect(row.sourceRegisterTrashed).toBe(false)
    expect(row.targetRegisterTrashed).toBe(true)
  })
})

describe('buildTransferLookups — a trashed worker', () => {
  const lookups = buildTransferLookups(
    {
      cashRegisters: [],
      trashedCashRegisters: [],
      trashedInvestments: [],
      investments: [],
      workers: [{ id: 1, name: 'Jan Aktywny', role: 'EMPLOYEE', email: '', language: null }],
      trashedWorkers: [{ id: 2, name: 'Piotr W Koszu', role: 'EMPLOYEE', email: '', language: null }],
      otherCategories: [],
      expenseCategories: [],
    },
    mediaMap,
  )

  it('keeps his name on a cancelled row he received and authored', () => {
    const row = mapTransferRow({ ...doc([]), worker: 2, createdBy: 2, cancelled: true }, lookups)

    expect(row.workerName).toBe('Piotr W Koszu')
    expect(row.createdByName).toBe('Piotr W Koszu')
  })
})
