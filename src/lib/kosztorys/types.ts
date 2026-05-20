// Subset of Univer's IWorkbookData / IWorksheetData that we mutate server-side.
// We don't import from @univerjs/core here to keep this lib usable in the
// Payload hook context without pulling DOM-dependent code.

export type MaterialKindT = 'budowlane' | 'wykończeniowe'

export type ICellDataT = {
  v?: string | number | boolean
  f?: string
  s?: string
}

export type IWorksheetDataT = {
  id: string
  name: string
  rowCount: number
  columnCount: number
  cellData: Record<number, Record<number, ICellDataT>>
  rowData?: Record<number, unknown>
  columnData?: Record<number, unknown>
  mergeData?: unknown[]
  freeze?: unknown
  [key: string]: unknown
}

export type IWorkbookDataT = {
  id: string
  name: string
  appVersion: string
  locale: string
  styles: Record<string, unknown>
  sheetOrder: string[]
  sheets: Record<string, IWorksheetDataT>
  resources?: unknown[]
}
