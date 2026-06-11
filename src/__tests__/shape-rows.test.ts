import { describe, it, expect, vi } from 'vitest'

// server-only throws at import time outside Next.js — stub it out
vi.mock('server-only', () => ({}))

import { shapeCashRegisters } from '@/lib/queries/cash-registers'
import { shapeInvestments } from '@/lib/queries/investments'
import type { CashRegisterRefT, WorkerRefT, InvestmentRefT } from '@/types/reference-data'
import type { InvestmentFinancialsMapT } from '@/lib/queries/reference-data'

const workers: WorkerRefT[] = [{ id: 1, name: 'Adrian', role: 'MANAGER', email: 'a@x.pl' }]

const registers: CashRegisterRefT[] = [
  { id: 10, name: 'Kasa główna', type: 'MAIN', active: true, ownerId: 1 },
  { id: 11, name: 'Kasa bez właściciela', type: 'AUXILIARY' },
]

describe('shapeCashRegisters', () => {
  it('maps owner name, balance, and defaults', () => {
    const rows = shapeCashRegisters(registers, workers, { '10': 500 })
    expect(rows).toEqual([
      {
        id: 10,
        name: 'Kasa główna',
        ownerName: 'Adrian',
        balance: 500,
        type: 'MAIN',
        active: true,
      },
      {
        id: 11,
        name: 'Kasa bez właściciela',
        ownerName: '—',
        balance: 0,
        type: 'AUXILIARY',
        active: true,
      },
    ])
  })

  it('falls back to — when owner id has no matching worker', () => {
    const rows = shapeCashRegisters(
      [{ id: 12, name: 'Sierota', type: 'WORKER', active: false, ownerId: 999 }],
      workers,
      {},
    )
    expect(rows[0]).toMatchObject({ ownerName: '—', balance: 0, active: false })
  })
})

const baseInv: InvestmentRefT = {
  id: 5,
  name: 'Grojecka',
  status: 'active',
  address: 'Grójecka 1',
  phone: '123',
  email: 'g@x.pl',
  contactPerson: 'Pan G',
  notes: '',
  review: '',
  hasSheet: false,
  active: true,
}

describe('shapeInvestments', () => {
  it('computes balance and margin from financials', () => {
    const financials: InvestmentFinancialsMapT = {
      '5': {
        categoryCosts: [],
        totalMaterialCosts: 1000,
        totalCorrections: 0,
        totalIncome: 9547,
        totalLaborCosts: 3900,
        totalPayouts: 1000,
        totalRabat: 0,
        totalLoss: 0,
      },
    }
    const [row] = shapeInvestments([baseInv], financials)
    expect(row.totalCosts).toBe(4900) // 1000 + 3900
    expect(row.balance).toBe(4647) // 9547 - (1000 + 3900)
    expect(row.margin).toBe(2900) // 3900 - 1000
    expect(row).toMatchObject({ id: 5, name: 'Grojecka', status: 'active', hasSheet: false })
  })

  it('defaults to zeroed financials when investment has no entry', () => {
    const [row] = shapeInvestments([baseInv], {})
    expect(row).toMatchObject({
      totalCosts: 0,
      totalMaterialCosts: 0,
      totalIncome: 0,
      totalLaborCosts: 0,
      totalPayouts: 0,
      balance: 0,
      margin: 0,
    })
  })
})
