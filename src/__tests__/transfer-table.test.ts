import { describe, it, expect, vi } from 'vitest'

// Mock modules that fail in test environment (server-only, CSS, React components)
vi.mock('server-only', () => ({}))
vi.mock('@/components/transfers/invoice-cell', () => ({ InvoiceCell: () => null }))
vi.mock('@/components/dialogs/note-dialog', () => ({ NoteCell: () => null }))

import { mapTransferRow, buildTransferLookups, type TransferLookupsT } from '@/lib/tables/transfers'

// ── Mock data ───────────────────────────────────────────────────────

const refData = {
  cashRegisters: [
    { id: 1, name: 'Kasa główna', type: 'MAIN' },
    { id: 2, name: 'Kasa pomocnicza', type: 'AUXILIARY' },
  ],
  investments: [{ id: 10, name: 'Inwestycja A' }],
  workers: [
    { id: 100, name: 'Jan Kowalski', type: 'MANAGER' },
    { id: 101, name: 'Anna Nowak', type: 'EMPLOYEE' },
  ],
  otherCategories: [{ id: 50, name: 'Materiały' }],
}

const emptyMediaMap = new Map()

const baseDoc = {
  id: 1,
  description: 'Test transfer',
  amount: 500,
  type: 'INVESTMENT_EXPENSE',
  paymentMethod: 'CASH',
  date: '2026-02-20',
  cashRegister: 1,
  targetRegister: null,
  investment: 10,
  worker: null,
  otherCategory: null,
  invoice: null,
  invoiceNote: null,
  createdBy: 100,
}

// ═══════════════════════════════════════════════════════════════════════
// mapTransferRow — createdByName resolution
// ═══════════════════════════════════════════════════════════════════════

describe('mapTransferRow — createdByName', () => {
  it('resolves createdBy ID to user name via lookups', () => {
    const lookups = buildTransferLookups(refData, emptyMediaMap)
    const row = mapTransferRow(baseDoc, lookups)
    expect(row.createdByName).toBe('Jan Kowalski')
  })

  it('returns "—" when createdBy is null', () => {
    const lookups = buildTransferLookups(refData, emptyMediaMap)
    const row = mapTransferRow({ ...baseDoc, createdBy: null }, lookups)
    expect(row.createdByName).toBe('—')
  })

  it('returns "—" when createdBy ID not in lookup', () => {
    const lookups = buildTransferLookups(refData, emptyMediaMap)
    const row = mapTransferRow({ ...baseDoc, createdBy: 999 }, lookups)
    expect(row.createdByName).toBe('—')
  })

  it('resolves createdBy from populated object (no lookups)', () => {
    const row = mapTransferRow({
      ...baseDoc,
      createdBy: { id: 100, name: 'Jan Kowalski' },
      cashRegister: { id: 1, name: 'Kasa główna' },
      investment: { id: 10, name: 'Inwestycja A' },
    })
    expect(row.createdByName).toBe('Jan Kowalski')
  })
})
