// Bare pl-PL number with 2 decimals (no currency symbol) for dense grid cells and subtotals —
// distinct from `formatPLN`, which emits "zł" and is too wide for the spreadsheet layout.
export const formatNet = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
