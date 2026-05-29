// Shortcut to the owner's Google Sheets file picker (account index u/0). Used by
// the /kosztorysy header, the per-investment iframe view, and AddSheetDialog so
// the user can spin up a fresh sheet in a new tab and paste its URL back without
// losing their place in the app.
export const ALL_SHEETS_URL = 'https://docs.google.com/spreadsheets/u/0/'

// A kosztorys (a registered Google Sheet) is either linked to an investment or
// stands alone. Mirrors the TRANSFER_TYPES pattern: const tuple → derived type →
// label map, so the Status column (and any future filter) share one source.
export const SHEET_STATUSES = ['linked', 'unlinked'] as const
export type SheetStatusT = (typeof SHEET_STATUSES)[number]

export const SHEET_STATUS_LABELS: Record<SheetStatusT, string> = {
  linked: 'Powiązane',
  unlinked: 'Bez inwestycji',
}
