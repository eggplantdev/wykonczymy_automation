// Shared column widths for the two stacked summary blocks (etap totals + Podsumowanie). Both render
// as CSS grids and pin their first (label) column to the SAME width so the two grids line up down
// the panel instead of each auto-sizing its own first column. Values feed `gridTemplateColumns`.
export const SUMMARY_LABEL_COL = '13rem'
// Every trailing column (netto / brutto / udział) shares one width so they read as an even set.
export const SUMMARY_VALUE_COL = '7rem'

// Cell classes shared by both grids. All cells are direct children of ONE grid so `gap-px` over a
// `bg-border` container paints a 1px separator between every column and row; each cell repaints
// `bg-background` on top.
export const SUMMARY_LABEL_CELL = 'bg-background px-3 py-1'
export const SUMMARY_VALUE_CELL = 'bg-background px-3 py-1 text-right tabular-nums'

// For a cell whose figure doesn't exist on this row (a per-etap value has no „Bez etapu"). Muted so
// it stays out of the numbers. Only where another cell in the same row carries a real amount.
export const NOT_APPLICABLE = 'Nie dotyczy'
export const NOT_APPLICABLE_CELL = 'text-muted-foreground/60 text-xs font-normal'
