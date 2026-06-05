import { describe, it, expect, vi } from 'vitest'

// server-only throws at import time outside Next.js — stub it out
vi.mock('server-only', () => ({}))

import { shapeCashRegisters } from '@/lib/queries/cash-registers'
import type { CashRegisterRefT, WorkerRefT } from '@/types/reference-data'

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
