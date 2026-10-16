import { colOf, type SheetTabConfigT } from './sheet-configs'

// Google Sheets uses the spreadsheet locale's list separator inside formula
// argument lists: locales whose decimal mark is a comma (pl_PL, most of the EU)
// use ';', period-decimal locales (en_US, …) use ','.
export function formulaArgSeparator(locale: string | undefined): ';' | ',' {
  try {
    const decimal = new Intl.NumberFormat((locale ?? 'pl-PL').replace('_', '-'))
      .formatToParts(1.1)
      .find((p) => p.type === 'decimal')?.value
    return decimal === ',' ? ';' : ','
  } catch {
    return ';'
  }
}

// Full columns survive inserts (the header text is ignored by SUM/SUMIF), and a literal criterion
// can't come unstuck from a moved label cell.
export function buildTabSummary(
  cfg: SheetTabConfigT,
  summaryKeys: string[],
  argSep: ';' | ',',
): { labels: string[]; totals: string[] } {
  const typCol = colOf(cfg, 'typ')
  const amountCol = colOf(cfg, 'amount')
  const labels = cfg.includeGrandTotal
    ? [cfg.grandTotalLabel ?? 'RAZEM', ...summaryKeys]
    : [...summaryKeys]
  const totals = cfg.includeGrandTotal ? [`=SUM(${amountCol}:${amountCol})`] : []
  for (const t of summaryKeys) {
    const escaped = t.replace(/"/g, '""')
    totals.push(
      `=SUMIF(${typCol}:${typCol}${argSep} "${escaped}"${argSep} ${amountCol}:${amountCol})`,
    )
  }
  return { labels, totals }
}
