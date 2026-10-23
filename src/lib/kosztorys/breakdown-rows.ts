import { toGross } from '@/lib/kosztorys/calc'
import { billedMaterialsPair, faceValue, type MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { MaterialsBreakdownRowT } from '@/types/investment-financials'

export type PricedBreakdownRowT = { key: string; label: string; pair: MoneyPairT }

// A netto row crosses no stawka: its netto and its brutto are both on the invoice. Without a rate the
// investor is billed brutto, so it takes the investment's VAT on top.
export function breakdownRowPair(
  row: MaterialsBreakdownRowT,
  rate: number | null,
  vatRate: number,
): MoneyPairT {
  if (row.origin === 'gross') return billedMaterialsPair(row.net, rate)
  return rate == null
    ? faceValue(toGross(row.net, vatRate))
    : { net: row.net, gross: row.recordedGross }
}

export function pricedBreakdownRows(
  rows: MaterialsBreakdownRowT[],
  rate: number | null,
  vatRate: number,
): PricedBreakdownRowT[] {
  return rows.map((row) => ({
    key: `${row.origin}-${row.id ?? 'correction'}`,
    label: row.origin === 'netBilled' ? `${row.label} netto` : row.label,
    pair: breakdownRowPair(row, rate, vatRate),
  }))
}

// Merged AFTER pricing: a category's brutto receipts move with the stawka while its netto invoice is
// frozen, so no single raw row could stand for the sum.
export function categoryBreakdownRows(
  rows: MaterialsBreakdownRowT[],
  rate: number | null,
  vatRate: number,
): PricedBreakdownRowT[] {
  const byCategory = new Map<number | null, PricedBreakdownRowT>()
  for (const row of rows) {
    const pair = breakdownRowPair(row, rate, vatRate)
    const merged = byCategory.get(row.id)
    if (merged) {
      merged.pair = { net: merged.pair.net + pair.net, gross: merged.pair.gross + pair.gross }
    } else {
      byCategory.set(row.id, { key: `category-${row.id ?? 'correction'}`, label: row.label, pair })
    }
  }
  const correction = byCategory.get(null)
  byCategory.delete(null)
  const categories = [...byCategory.values()].sort((a, b) => a.label.localeCompare(b.label, 'pl'))
  return correction ? [...categories, correction] : categories
}
