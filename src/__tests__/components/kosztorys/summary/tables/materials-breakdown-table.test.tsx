import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MaterialsBreakdownTable } from '@/components/kosztorys/summary/tables/materials-breakdown-table'
import { formatNet } from '@/lib/kosztorys/format'
import type { MaterialsBreakdownRowT } from '@/types/investment-financials'

// The invoice is 8% apart and the rates below are 12% and 23%, so a brutto the rate derived could
// never coincide with the recorded one — every existing fixture is exactly 23% apart and can't tell.
const INVOICE_NET = 4453.33
const INVOICE_GROSS = 4809.6
const RECEIPT = 1230

const ROWS: MaterialsBreakdownRowT[] = [
  { id: 1, label: 'Materiały budowlane', net: RECEIPT, origin: 'gross' },
  {
    id: 2,
    label: 'Materiały wykończeniowe netto',
    net: INVOICE_NET,
    origin: 'netBilled',
    recordedGross: INVOICE_GROSS,
  },
]

// The grid is flat: a row is its label cell followed by one cell per value column.
function rowValues(label: string): string[] {
  const cells = Array.from(screen.getByText('Wydatki inwestycyjne').closest('.grid')!.children)
  const texts = cells.map((cell) => cell.textContent ?? '')
  const columns = texts.filter((text) => /^(Netto|Brutto|Różnica|Kwota)$/.test(text)).length
  const start = texts.indexOf(label)
  return texts.slice(start + 1, start + 1 + columns)
}

function renderAt(netRate: number | null) {
  return render(<MaterialsBreakdownTable rows={ROWS} netRate={netRate} />)
}

describe('MaterialsBreakdownTable — a „… netto" row is the invoice at any stawka', () => {
  it.each([0.12, 0.23])('at %s the netto row reads invoice netto / brutto / Różnica', (rate) => {
    renderAt(rate)
    expect(rowValues('Materiały wykończeniowe netto')).toEqual([
      formatNet(INVOICE_NET),
      formatNet(INVOICE_GROSS),
      formatNet(INVOICE_NET - INVOICE_GROSS),
    ])
  })

  it('the brutto row still moves with the stawka', () => {
    const { unmount } = renderAt(0.12)
    const at12 = rowValues('Materiały budowlane')
    unmount()
    renderAt(0.23)
    const at23 = rowValues('Materiały budowlane')

    expect(at12[1]).toBe(formatNet(RECEIPT))
    expect(at23[1]).toBe(formatNet(RECEIPT))
    expect(at12[0]).not.toBe(at23[0])
    expect(at23[0]).toBe(formatNet(1000))
  })

  it('Razem Brutto is the brutto receipt plus the invoice brutto', () => {
    renderAt(0.23)
    expect(rowValues('Razem')).toEqual([
      formatNet(1000 + INVOICE_NET),
      formatNet(RECEIPT + INVOICE_GROSS),
      formatNet(1000 + INVOICE_NET - RECEIPT - INVOICE_GROSS),
    ])
  })

  // Owner Q1: with no stawka there is one „Kwota" column and it shows what the investor is billed,
  // so Razem still equals „Materiały" in the podsumowanie.
  it('with no stawka: a single „Kwota" column, the netto row at its netto', () => {
    renderAt(null)
    expect(screen.getByText('Kwota')).toBeInTheDocument()
    expect(screen.queryByText('Brutto')).not.toBeInTheDocument()
    expect(rowValues('Materiały wykończeniowe netto')).toEqual([formatNet(INVOICE_NET)])
    expect(rowValues('Razem')).toEqual([formatNet(RECEIPT + INVOICE_NET)])
  })
})
