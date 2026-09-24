import { MONEY_TOLERANCE, netForQtyForView, rowPlannedNetForView } from '@/lib/kosztorys/calc'
import type { ViewPricingT } from '@/lib/kosztorys/types'
import { FOOTER_ROWS, fold, type FooterRowKeyT } from './columns'
import type { ParsedItemT, ParsedLaborTabT } from './parse-labor-tab'
import type { ResolvedLaborColumnsT } from './resolve-columns'

export type { FooterRowKeyT }

/**
 * The app-side sums a footer row can be checked against. `measuredNet` has no footer row of its own —
 * it exists because „wartość netto" is not one figure across sheets: some clients compute it from
 * Przedmiar (the offer), others from Pomiar z natury, and a sheet whose Pomiar is partly hand-typed
 * puts it somewhere our two stored figures cannot reach at all. Pricing the sheet's own Pomiar column
 * is the only like-for-like reading of that row.
 */
export type AppTotalKeyT = FooterRowKeyT | 'measuredNet'

export type FooterComparisonT = {
  key: FooterRowKeyT
  // The sheet's own wording, so the preview names the row the owner will look for.
  label: string
  sheetValue: number | null
  // What the sheet's own prace add up to on the reading this row is checked against. `null` when
  // that figure cannot be computed at all — a sheet with no Pomiar column has nothing to hold
  // „wartość netto" against — and a row nobody could check is not a row anybody may call wrong.
  appValue: number | null
  delta: number | null
  matches: boolean
  // Which app figure the sheet row turned out to agree with. The owner's labels do NOT reliably say
  // which figure a row holds — on sheets where nothing is executed yet all of them carry the same
  // number, and on others „wartość netto" sits over the executed figure — so a row is checked
  // against every figure its label leaves open (`CANDIDATES`) and reported against whichever it
  // matches. `null` when it matches none.
  matchedAgainst: AppTotalKeyT | null
}

/**
 * The summary rows where the sheet disagrees with itself: it states a figure, and its own prace do
 * not add up to it. A row we could not find at all is deliberately NOT one of these — a sheet with
 * no such summary says nothing about how we read it — and neither is one we had no figure to check
 * it against, for the same reason read from the other side.
 */
export const footerDisagreements = (footer: readonly FooterComparisonT[]): FooterComparisonT[] =>
  footer.filter((total) => total.sheetValue !== null && total.appValue !== null && !total.matches)

// The parser drops both subcontractor stawka fields and the import never sets a global
// discount, so the client-view price is fully determined here — the coefficients only ever feed the
// two subcontractor views.
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
 * Compare the sheet's own summary rows against what the app computes from the same prace. The figure
 * depends on every price, quantity and rabat individually, so agreement is the strongest available
 * evidence that the parse read the right columns — which is why the app side goes through `calc.ts`
 * rather than a local sum: a reimplementation would agree with the parser's mistakes.
 *
 * A disagreement is reported, never thrown. Sheets with broken footer formulas exist, and refusing
 * to import because the owner's own SUM is stale would make the button useless on exactly the sheets
 * that need it.
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

  // Only rows below the last praca are summary rows: „wartość netto" is also a column header, and a
  // praca can be described in words that start the same way.
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
 * Which app figures each summary row may be checked against. „wartość netto" gets all of them: the
 * owner's labels do not reliably say which figure that row holds, and Przedmiar and Pomiar are both
 * defensible readings of it — see `matchedAgainst`.
 *
 * „R netto - suma prac wykonannych" gets only its namesake, because that label names one figure and
 * one only. A footer that sums the wrong columns lands on the OFFER total, and letting the row match
 * there is exactly how a sheet disagreeing with itself renders as a clean one.
 */
const CANDIDATES: Record<FooterRowKeyT, AppTotalKeyT[]> = {
  plannedNet: [...FOOTER_ROWS.map(({ key }) => key), 'measuredNet'],
  executedNet: ['executedNet'],
}

// Where a row lands when it agrees with nothing. „wartość netto" falls back to the sum of the same
// column the sheet totals there, never to Przedmiar: a sheet with work in progress prices those two
// differently by construction, so pairing them reported a five-figure „difference" on a sheet that
// was parsed perfectly.
const DEFAULT_CANDIDATE: Record<FooterRowKeyT, AppTotalKeyT> = {
  plannedNet: 'measuredNet',
  executedNet: 'executedNet',
}

/**
 * The sheet's Pomiar column priced by us — read straight off the grid rather than from the parsed
 * items, because `sheetMeasuredQty` is deliberately null wherever that cell sums the etapy, and this
 * has to reproduce the sheet's own total whatever is behind the number. `null` with no Pomiar column,
 * so an absent figure can never masquerade as a matching zero.
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

// The summary figure normally sits under the „Wartość netto" column, but the owner merges cells in
// the footer freely and it lands a column or two over. A row with exactly one number in it has no
// ambiguity to resolve, so that number is taken; two or more and we'd be guessing, so we don't.
function readFooterValue(row: readonly unknown[], netValueColumn: number): number | null {
  const preferred = row[netValueColumn]
  if (typeof preferred === 'number') return preferred

  const numbers = row.filter((cell): cell is number => typeof cell === 'number')
  return numbers.length === 1 ? numbers[0] : null
}
