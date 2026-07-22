import { describe, it, expect } from 'vitest'
import { buildPrintHtml } from '@/lib/export/print'
import type { TransferRowT } from '@/types/transfers'
import type { HeaderFieldT } from '@/types/export'

const makeRow = (overrides: Partial<TransferRowT> = {}): TransferRowT => ({
  id: 1,
  description: 'Test transfer',
  amount: 100,
  type: 'INVESTMENT_EXPENSE',
  paymentMethod: 'CASH',
  date: '2026-01-15',
  sourceRegisterId: 1,
  sourceRegisterName: 'Kasa główna',
  targetRegisterId: null,
  targetRegisterName: '',
  investmentId: 1,
  investmentName: 'Inwestycja A',
  expenseCategoryId: null,
  expenseCategoryName: '',
  otherCategoryName: '',
  otherCategoryId: null,
  workerName: '—',
  workerId: null,
  createdByName: 'Admin',
  createdById: 1,
  createdAt: '2026-01-15T10:00:00Z',
  invoiceUrl: null,
  invoiceFilename: null,
  invoiceMimeType: null,
  invoiceNote: null,
  cancelled: false,
  settled: false,
  vatPlane: null,
  originalType: null,
  ...overrides,
})

describe('buildPrintHtml', () => {
  it('renders header fields when provided', () => {
    const fields: HeaderFieldT[] = [
      { label: 'Inwestycja', value: 'Test' },
      { label: 'Saldo', value: '1 000,00 zł' },
    ]
    const html = buildPrintHtml([], ['date'], fields)

    expect(html).toContain('Inwestycja')
    expect(html).toContain('Test')
    expect(html).toContain('Saldo')
    expect(html).toContain('1 000,00 zł')
  })

  it('renders table rows with visible columns only', () => {
    const rows = [makeRow({ description: 'Materiały budowlane' })]
    const html = buildPrintHtml(rows, ['date', 'description', 'amount'], [])

    expect(html).toContain('Data')
    expect(html).toContain('Opis')
    expect(html).toContain('Kwota')
    expect(html).toContain('Materiały budowlane')
  })

  it('marks cancelled rows', () => {
    const rows = [makeRow({ cancelled: true })]
    const html = buildPrintHtml(rows, ['description'], [])

    expect(html).toContain('cancelled')
  })

  it('escapes HTML in cell values', () => {
    const rows = [makeRow({ description: '<script>alert("xss")</script>' })]
    const html = buildPrintHtml(rows, ['description'], [])

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('skips unknown column IDs', () => {
    const html = buildPrintHtml([], ['nonexistent', 'date'], [])

    expect(html).toContain('Data')
    expect(html).not.toContain('nonexistent')
  })

  it('returns valid HTML document', () => {
    const html = buildPrintHtml([], ['date'], [])

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="pl">')
    expect(html).toContain('@page')
  })
})
