import { billedMaterialsPair, faceValue, type MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { MaterialsBreakdownRowT } from '@/types/investment-financials'

export type PricedBreakdownRowT = { key: string; label: string; pair: MoneyPairT }

// A netto row crosses nothing: its netto and its brutto are both on the invoice, so no stawka may move
// either.
export function breakdownRowPair(row: MaterialsBreakdownRowT, rate: number | null): MoneyPairT {
  if (row.origin === 'gross') return billedMaterialsPair(row.net, rate)
  return rate == null ? faceValue(row.net) : { net: row.net, gross: row.recordedGross }
}

export function pricedBreakdownRows(
  rows: MaterialsBreakdownRowT[],
  rate: number | null,
): PricedBreakdownRowT[] {
  return rows.map((row) => ({
    key: `${row.origin}-${row.id ?? 'correction'}`,
    label: row.origin === 'netBilled' ? `${row.label} netto` : row.label,
    pair: breakdownRowPair(row, rate),
  }))
}

// Merged AFTER pricing: a category's brutto receipts move with the stawka while its netto invoice is
// frozen, so no single raw row could stand for the sum.
export function categoryBreakdownRows(
  rows: MaterialsBreakdownRowT[],
  rate: number | null,
): PricedBreakdownRowT[] {
  const byCategory = new Map<number | null, PricedBreakdownRowT>()
  for (const row of rows) {
    const pair = breakdownRowPair(row, rate)
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
