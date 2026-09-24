import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MaterialsTransactionsTable } from '@/components/kosztorys/summary/tables/materials-transactions-table'
import { formatNet } from '@/lib/kosztorys/format'
import type { PreviewFileT } from '@/types/media'
import type { MaterialTransactionRowT } from '@/types/transfers'

// The body is virtualized and jsdom has no layout, so only the header and the „Razem" footer are
// asserted — both render outside the virtualized rows.
const ROW_BASE = {
  date: '2026-09-01',
  label: 'Materiały budowlane',
  description: null,
  invoices: [] as PreviewFileT[],
  invoiceNote: null,
} as const

const ROWS: MaterialTransactionRowT[] = [
  { ...ROW_BASE, id: 1, type: 'INVESTMENT_EXPENSE', amount: 2460, billed: 2460, settled: false },
  {
    ...ROW_BASE,
    id: 2,
    type: 'INVESTMENT_EXPENSE_NET',
    amount: 1230,
    billed: 1000,
    settled: false,
  },
  { ...ROW_BASE, id: 3, type: 'INVESTMENT_EXPENSE', amount: 999, billed: 999, settled: true },
]

function renderList(preview: boolean) {
  return render(
    <MaterialsTransactionsTable
      investmentId={1}
      investmentName="Test"
      rows={ROWS}
      preview={preview}
    />,
  )
}

function footerTotal(): string | null {
  const label = screen.getByText('Razem')
  return label.nextElementSibling?.textContent ?? null
}

describe('MaterialsTransactionsTable — the investor gets one brutto list', () => {
  it('no dataset switch and no Netto column', () => {
    renderList(true)
    expect(screen.queryByRole('group', { name: 'Zestaw wydatków' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Netto/ })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Kwota/ })).toBeInTheDocument()
  })

  it('Razem is Σ brutto — the netto invoice at its brutto, the settled row excluded', () => {
    renderList(true)
    expect(footerTotal()).toBe(formatNet(2460 + 1230))
  })
})

describe('MaterialsTransactionsTable — the manager keeps the dataset switch', () => {
  it('offers the brutto / netto / settled sets', () => {
    renderList(false)
    expect(screen.getByRole('group', { name: 'Zestaw wydatków' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Materiały rozliczane netto/ })).toBeInTheDocument()
  })
})
