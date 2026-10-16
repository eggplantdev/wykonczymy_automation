import {
  TRANSFERS_SUMMARY_TYPES,
  TRANSFER_TYPE_LABELS,
  CORRECTION_MOVED_LABEL,
} from '@/lib/constants/transfers'

export type SheetTabConfigT = {
  tabName: string
  header: string[]
  // Invariant: Object.keys(fieldMatchers)[i] must be the field that matches header[i]
  // — field order drives cell-write order and column-letter derivation.
  fieldMatchers: Record<string, (h: string) => boolean>
  includeGrandTotal: boolean // RAZEM + =SUM(amount-col) — expenses only
  grandTotalLabel?: string
  dataColWidths: number[]
}

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

// Driven by the FIXED summary layout (incl. a now-zero Korekta column), NOT the routing list —
// so a tab rebuild never shifts columns out from under existing formulas.
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

// a fixed cap would make reads silently truncate — the reconciler would
// then see un-read rows as orphans and delete them.
export const tabRange = (cfg: SheetTabConfigT) => `'${cfg.tabName}'!A:Z`
export const MAX_HEADER_SCAN_ROWS = 15

export const normalize = (cell: unknown): string =>
  String(cell ?? '')
    .trim()
    .toLowerCase()
