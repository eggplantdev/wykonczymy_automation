import { fold } from '@/lib/kosztorys/fold'
import { MONEY_TOLERANCE, netForQtyForView, rowPlannedNetForView } from '@/lib/kosztorys/calc'
import type { ViewPricingT } from '@/lib/kosztorys/types'
import { FOOTER_ROWS, type FooterRowKeyT } from './columns'
import type { ParsedItemT, ParsedLaborTabT } from './parse-labor-tab'
import type { ResolvedLaborColumnsT } from './resolve-columns'

export type { FooterRowKeyT }

export type AppTotalKeyT = FooterRowKeyT | 'measuredNet'

export type FooterComparisonT = {
  key: FooterRowKeyT
  label: string
  sheetValue: number | null
  appValue: number | null
  delta: number | null
  matches: boolean
  matchedAgainst: AppTotalKeyT | null
}

export const footerDisagreements = (footer: readonly FooterComparisonT[]): FooterComparisonT[] =>
  footer.filter((total) => total.sheetValue !== null && total.appValue !== null && !total.matches)

const asPricing = (item: ParsedItemT): ViewPricingT => ({
  ...item,
  wToolsOverrideValue: null,
  ownToolsOverrideValue: null,
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  globalDiscountActive: false,
  globalWToolsCoeff: 0,
  globalOwnToolsCoeff: 0,
})

/**
 * the app side goes through `calc.ts`
 * rather than a local sum: a reimplementation would agree with the parser's mistakes.
 */
export function compareFooterTotals(
  grid: unknown[][],
  resolved: ResolvedLaborColumnsT,
  parsed: ParsedLaborTabT,
): FooterComparisonT[] {
  const qtyDoneByItem = new Map<number, number>()
  for (const entry of parsed.progress) {
    qtyDoneByItem.set(entry.itemId, (qtyDoneByItem.get(entry.itemId) ?? 0) + entry.qtyDone)
  }

  const appValues: Record<AppTotalKeyT, number | null> = {
    plannedNet: parsed.items.reduce(
      (total, item) => total + rowPlannedNetForView(asPricing(item), 'client'),
      0,
    ),
    executedNet: parsed.items.reduce(
      (total, item) =>
        total + netForQtyForView(asPricing(item), qtyDoneByItem.get(item.id) ?? 0, 'client'),
      0,
    ),
    measuredNet: measuredNetTotal(grid, resolved, parsed),
  }

  const footer = parsed.footerStart < 0 ? [] : grid.slice(parsed.footerStart)

  return FOOTER_ROWS.map(({ key, label, matches }) => {
    const row = footer.find((cells) => cells.some((cell) => matches(fold(cell))))
    const sheetValue = row === undefined ? null : readFooterValue(row, resolved.columns.netValue)

    const matchedAgainst =
      sheetValue === null
        ? null
        : (CANDIDATES[key].find((candidate) => {
            const value = appValues[candidate]
            return value !== null && Math.abs(sheetValue - value) < MONEY_TOLERANCE
          }) ?? null)
    const appValue = appValues[matchedAgainst ?? DEFAULT_CANDIDATE[key]]

    return {
      key,
      label,
      sheetValue,
      appValue,
      delta: sheetValue === null || appValue === null ? null : sheetValue - appValue,
      matches: matchedAgainst !== null,
      matchedAgainst,
    }
  })
}

/**
 * A footer that sums the wrong columns lands on the OFFER total, and letting the row match
 * there is exactly how a sheet disagreeing with itself renders as a clean one.
 */
const CANDIDATES: Record<FooterRowKeyT, AppTotalKeyT[]> = {
  plannedNet: [...FOOTER_ROWS.map(({ key }) => key), 'measuredNet'],
  executedNet: ['executedNet'],
}

const DEFAULT_CANDIDATE: Record<FooterRowKeyT, AppTotalKeyT> = {
  plannedNet: 'measuredNet',
  executedNet: 'executedNet',
}

/**
 * read straight off the grid rather than from the parsed
 * items, because `sheetMeasuredQty` is deliberately null wherever that cell sums the etapy
 */
function measuredNetTotal(
  grid: unknown[][],
  resolved: ResolvedLaborColumnsT,
  parsed: ParsedLaborTabT,
): number | null {
  const column = resolved.columns.measuredQty
  if (column === undefined) return null

  let total = 0
  for (const item of parsed.items) {
    const sheetRow = parsed.sheetRowByItemId.get(item.id)
    if (sheetRow === undefined) return null
    const cell = grid[sheetRow - 1]?.[column]
    const qty = typeof cell === 'number' ? cell : Number(cell)
    total += netForQtyForView(asPricing(item), Number.isFinite(qty) ? qty : 0, 'client')
  }
  return total
}

function readFooterValue(row: readonly unknown[], netValueColumn: number): number | null {
  const preferred = row[netValueColumn]
  if (typeof preferred === 'number') return preferred

  const numbers = row.filter((cell): cell is number => typeof cell === 'number')
  return numbers.length === 1 ? numbers[0] : null
}
