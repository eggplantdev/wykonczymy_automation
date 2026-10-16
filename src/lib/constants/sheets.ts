export const ALL_SHEETS_URL = 'https://docs.google.com/spreadsheets/u/0/'

const SHEET_STATUSES = ['linked', 'unlinked'] as const
export type SheetStatusT = (typeof SHEET_STATUSES)[number]

export const SHEET_STATUS_LABELS: Record<SheetStatusT, string> = {
  linked: 'Powiązane',
  unlinked: 'Bez inwestycji',
}
