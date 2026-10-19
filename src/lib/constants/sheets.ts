export const ALL_SHEETS_URL = 'https://docs.google.com/spreadsheets/u/0/'

export type SheetStatusT = 'linked' | 'unlinked'

export const SHEET_STATUS_LABELS: Record<SheetStatusT, string> = {
  linked: 'Powiązane',
  unlinked: 'Bez inwestycji',
}
