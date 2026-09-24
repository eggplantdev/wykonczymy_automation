import { describe, expect, it } from 'vitest'

import {
  breakdownRowPair,
  categoryBreakdownRows,
  pricedBreakdownRows,
} from '@/lib/kosztorys/breakdown-rows'
import { faceValue } from '@/lib/kosztorys/summary-economics'
import type { MaterialsBreakdownRowT } from '@/types/investment-financials'

// 8% apart, so a brutto the rate derived could never coincide with the invoice's.
const INVOICE_NET = 4453.33
const INVOICE_GROSS = 4809.6

// The builder's order: brutto rows, Korekta, then the netto block.
const ROWS: MaterialsBreakdownRowT[] = [
  { id: 2, label: 'Materiały wykończeniowe', net: 1230, origin: 'gross' },
  { id: 1, label: 'Materiały budowlane', net: 615, origin: 'gross' },
  { id: null, label: 'Korekta (bez kategorii)', net: -50, origin: 'gross' },
  {
    id: 2,
    label: 'Materiały wykończeniowe',
    net: INVOICE_NET,
    origin: 'netBilled',
    recordedGross: INVOICE_GROSS,
  },
  { id: 3, label: 'Pozostałe koszty', net: 200, origin: 'netBilled', recordedGross: 246 },
]

const RATES = [0.12, 0.23, null]

function sums(pairs: { net: number; gross: number }[]) {
  return pairs.reduce(
    (total, pair) => ({ net: total.net + pair.net, gross: total.gross + pair.gross }),
    { net: 0, gross: 0 },
  )
}

const INVOICE = { net: INVOICE_NET, gross: INVOICE_GROSS }
const grossRow = (net: number): MaterialsBreakdownRowT => ({
  id: 1,
  label: 'M',
  net,
  origin: 'gross',
})
const netRow = (net: number, recordedGross: number): MaterialsBreakdownRowT => ({
  id: 1,
  label: 'M',
  net,
  origin: 'netBilled',
  recordedGross,
})

describe('breakdownRowPair (one „Wydatki inwestycyjne" row on both planes)', () => {
  it('a brutto row keeps its receipt and divides down to netto', () => {
    const p = breakdownRowPair(grossRow(123), 0.23)
    expect(p.gross).toBe(123)
    expect(p.net).toBeCloseTo(100)
  })

  it.each([0.12, 0.23])('a netto row shows the invoice on both planes at a %s rate', (rate) => {
    expect(breakdownRowPair(netRow(INVOICE.net, INVOICE.gross), rate)).toEqual(INVOICE)
  })

  // Owner Q1: with no rate the table has one „Kwota" column, and it shows what the investor is
  // billed — the netto — so Razem still equals „Materiały" in the podsumowanie.
  it('no rate = one figure per row, the billed one', () => {
    expect(breakdownRowPair(netRow(INVOICE.net, INVOICE.gross), null)).toEqual(
      faceValue(INVOICE.net),
    )
    expect(breakdownRowPair(grossRow(123), null)).toEqual({ net: 123, gross: 123 })
  })

  // „Korekta (bez kategorii)" arrives negative. The bug this replaced flipped or flattened such a
  // row, so pin both the sign and the ratio: a credit must cross the bridge exactly like a charge.
  it('a negative row keeps its sign — a brutto one its ratio, a netto one its invoice', () => {
    const gross = breakdownRowPair(grossRow(-123), 0.23)
    expect(gross.gross).toBe(-123)
    expect(gross.net).toBeCloseTo(-100)

    expect(breakdownRowPair(netRow(-100, -108), 0.23)).toEqual({ net: -100, gross: -108 })
  })
})

describe('pricedBreakdownRows — one row per input row', () => {
  it.each(RATES)('at %s each pair is breakdownRowPair of its row', (rate) => {
    expect(pricedBreakdownRows(ROWS, rate).map((row) => row.pair)).toEqual(
      ROWS.map((row) => breakdownRowPair(row, rate)),
    )
  })

  it('suffixes a netto row and keys stay unique', () => {
    const rows = pricedBreakdownRows(ROWS, 0.23)
    expect(rows.map((row) => row.label)).toEqual([
      'Materiały wykończeniowe',
      'Materiały budowlane',
      'Korekta (bez kategorii)',
      'Materiały wykończeniowe netto',
      'Pozostałe koszty netto',
    ])
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
  })
})

describe('categoryBreakdownRows — one row per category', () => {
  it('merges a category, keeps a netto-only one, orders by name with Korekta last', () => {
    expect(categoryBreakdownRows(ROWS, 0.23).map((row) => row.label)).toEqual([
      'Materiały budowlane',
      'Materiały wykończeniowe',
      'Pozostałe koszty',
      'Korekta (bez kategorii)',
    ])
  })

  it('a merged category is its brutto receipt priced at the rate plus the frozen invoice', () => {
    const merged = categoryBreakdownRows(ROWS, 0.23).find(
      (row) => row.label === 'Materiały wykończeniowe',
    )
    expect(merged?.pair.net).toBeCloseTo(1000 + INVOICE_NET, 2)
    expect(merged?.pair.gross).toBeCloseTo(1230 + INVOICE_GROSS, 2)
  })

  it('a negative korekta keeps its sign and its own pricing', () => {
    const correction = categoryBreakdownRows(ROWS, 0.23).at(-1)
    expect(correction?.pair).toEqual(breakdownRowPair(ROWS[2], 0.23))
    expect(correction?.pair.gross).toBe(-50)
    expect(correction?.pair.net).toBeLessThan(0)
  })

  it.each(RATES)('at %s both Σ equal the unmerged rows', (rate) => {
    const merged = sums(categoryBreakdownRows(ROWS, rate).map((row) => row.pair))
    const unmerged = sums(pricedBreakdownRows(ROWS, rate).map((row) => row.pair))
    expect(merged.net).toBeCloseTo(unmerged.net, 6)
    expect(merged.gross).toBeCloseTo(unmerged.gross, 6)
  })
})
