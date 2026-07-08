import { colOf, type SheetTabConfigT } from './sheet-configs'

// Google Sheets uses the spreadsheet locale's list separator inside formula
// argument lists: locales whose decimal mark is a comma (pl_PL, most of the EU)
// use ';', period-decimal locales (en_US, …) use ','. Detect the decimal mark via
// Intl and pick accordingly, so a SUMIF written here parses on a non-PL sheet too.
// Defaults to ';' if the locale is unknown/unparseable (the Polish-sheet case).
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

// Build the summary row values: optional RAZEM (grand total) + one SUMIF per
// summary key. Uses full-column ranges (C:C / E:E, derived from the config's typ
// and amount columns) and a LITERAL criterion — NOT `C2:C` + a label-cell
// reference like the old form did. That older form drifted: any row insert or a
// sort spanning the summary columns shifted the formula and rewrote its criterion
// to an empty cell, zeroing every per-type total. Full columns survive inserts
// (the header text is ignored by SUM/SUMIF), and a literal criterion can't come
// unstuck from a moved label cell. argSep follows the sheet locale. Key names are
// double-quote-escaped for the formula string.
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
