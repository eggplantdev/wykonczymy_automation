import {
  TRANSFERS_SUMMARY_TYPES,
  TRANSFER_TYPE_LABELS,
  CORRECTION_MOVED_LABEL,
} from '@/lib/constants/transfers'

// One row per transfer in a single long table, one app-managed tab per
// SheetTabConfigT. Columns are located by header text (normalized,
// keyword-contains) so the sheet layout — column order, extra columns, a summary
// block — can change without touching this code. The id column is the join key
// (one row per transferId). The row SYNC (append/read) only ever touches the
// mapped fields; the header, the SUMIF summary and all formatting are written
// once by setupTab.
export type SheetTabConfigT = {
  tabName: string
  header: string[]
  // Invariant: Object.keys(fieldMatchers)[i] must be the field that matches header[i]
  // — field order drives cell-write order and column-letter derivation.
  fieldMatchers: Record<string, (h: string) => boolean>
  includeGrandTotal: boolean // RAZEM + =SUM(amount-col) — expenses only
  // Label for the grand-total column when includeGrandTotal is set. Defaults to
  // 'RAZEM'; the rozliczone tab overrides it to 'RAZEM rozliczone' so the two
  // expense-shaped tabs read distinctly.
  grandTotalLabel?: string
  dataColWidths: number[]
}

// A row's cell values keyed by config field name; `transferId` doubles as the
// id column value.
export type TabRowInputT = { transferId: number } & Record<string, string | number>

export const EXPENSES_TAB_CONFIG: SheetTabConfigT = {
  tabName: 'wydatki inwestycyjne (tylko do odczytu)',
  // The sync locates columns by keyword, so these exact labels aren't
  // load-bearing for reads — but they must keep their keywords.
  header: ['id', 'data', 'typ wydatku inwestycyjnego', 'opis', 'kwota', 'kategoria', 'notatka'],
  fieldMatchers: {
    id: (h) => h === 'id',
    date: (h) => h.includes('data'),
    typ: (h) => h.includes('typ'),
    description: (h) => h.includes('opis'),
    amount: (h) => h.includes('kwota'),
    category: (h) => h.includes('kategoria'),
    note: (h) => h.includes('notatka'),
  },
  includeGrandTotal: true,
  dataColWidths: [60, 100, 200, 240, 110, 140, 180],
}

// The separate "rozliczone R+M" tab: same column shape and per-category SUMIF
// summary as the expenses tab (a third instance of the same pattern), so it
// mirrors settled expenses at their real amount with the category breakdown for
// free. Only the tab name and the grand-total label differ.
export const SETTLED_TAB_CONFIG: SheetTabConfigT = {
  ...EXPENSES_TAB_CONFIG,
  tabName: 'rozliczone R+M (tylko do odczytu)',
  grandTotalLabel: 'RAZEM rozliczone',
}

// No grand total: summing money-in (INVESTOR_DEPOSIT) with money-out (PAYOUT)
// with billing figures (LABOR_COST/RABAT/LOSS) and a signed CORRECTION produces
// a number with no financial meaning — per-type subtotals only.
export const TRANSFERS_TAB_CONFIG: SheetTabConfigT = {
  tabName: 'transfery (tylko do odczytu)',
  header: ['id', 'data', 'typ', 'opis', 'kwota', 'pracownik', 'kategoria', 'notatka'],
  fieldMatchers: {
    id: (h) => h === 'id',
    date: (h) => h.includes('data'),
    typ: (h) => h.includes('typ'),
    description: (h) => h.includes('opis'),
    amount: (h) => h.includes('kwota'),
    worker: (h) => h.includes('pracownik'),
    category: (h) => h.includes('kategoria'),
    note: (h) => h.includes('notatka'),
  },
  includeGrandTotal: false,
  dataColWidths: [60, 100, 160, 240, 110, 140, 140, 180],
}

// PL labels for the transfers tab's per-type SUMIF summary, in tab order. Driven
// by the FIXED summary layout (incl. a now-zero Korekta column), NOT the routing
// list — so a tab rebuild never shifts columns out from under existing formulas.
export const transferSummaryKeys = (): string[] =>
  TRANSFERS_SUMMARY_TYPES.map((t) =>
    t === 'CORRECTION' ? CORRECTION_MOVED_LABEL : TRANSFER_TYPE_LABELS[t],
  )

export function columnLetter(index: number): string {
  let n = index + 1
  let letter = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

export const fieldsOf = (cfg: SheetTabConfigT): string[] => Object.keys(cfg.fieldMatchers)
export const colOf = (cfg: SheetTabConfigT, field: string): string =>
  columnLetter(fieldsOf(cfg).indexOf(field))

// Open-ended rows (A:Z, no row cap): a kosztorys can hold any number of rows,
// and a fixed cap would make reads silently truncate — the reconciler would
// then see un-read rows as orphans and delete them. Google trims trailing empties,
// so an open range stays cheap. Columns are bounded at Z: the data block plus the
// summary fit well within, and Z leaves ample room.
export const tabRange = (cfg: SheetTabConfigT) => `'${cfg.tabName}'!A:Z`
export const MAX_HEADER_SCAN_ROWS = 15

export const normalize = (cell: unknown): string =>
  String(cell ?? '')
    .trim()
    .toLowerCase()
