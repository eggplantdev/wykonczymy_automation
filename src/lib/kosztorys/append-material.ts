import type { IWorkbookDataT, IWorksheetDataT, MaterialKindT } from './types'

// trailing space matches the source template; do not normalize.
export const MATERIALY_SHEET_NAME = 'materiały '

// 0-based: header rows live at 0..1, data starts at row 2 (row 3 in 1-based view).
const FIRST_DATA_ROW = 2
const MAX_DATA_ROW = 1000 // SUM in row 1 covers up to B1001 / F1001

type ColLayout = {
  amountCol: number
  descCol: number
  refCol: number
  labelCol: number
}

const LAYOUTS: Record<MaterialKindT, ColLayout> = {
  budowlane: { amountCol: 1, descCol: 2, refCol: 3, labelCol: 0 },
  wykończeniowe: { amountCol: 5, descCol: 6, refCol: 7, labelCol: 4 },
}

export type AppendMaterialInputT = {
  kind: MaterialKindT
  amount: number
  description: string
  transferId: number | string
  /** ISO date string — appended to description for traceability. */
  date?: string
}

export type AppendMaterialResultT =
  | { ok: true; rowIndex: number; cellA1: string }
  | { ok: false; reason: 'sheet-missing' | 'full' }

function findSheet(workbook: IWorkbookDataT, name: string): IWorksheetDataT | null {
  for (const sheetId of workbook.sheetOrder) {
    const sheet = workbook.sheets[sheetId]
    if (sheet?.name === name) return sheet
  }
  return null
}

function isEmpty(cell: { v?: unknown; f?: unknown } | undefined): boolean {
  if (!cell) return true
  if (cell.f !== undefined && cell.f !== null && cell.f !== '') return false
  return cell.v === undefined || cell.v === null || cell.v === ''
}

function colToA1(colIndex: number): string {
  let n = colIndex
  let s = ''
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

/**
 * Mutates `workbook` by appending a material row to the materiały tab.
 * Returns metadata about where the row was placed (or why it couldn't be).
 *
 * Append-only contract: never writes to rows 0–1 (header/SUM), never
 * overwrites a non-empty cell. Existing SUM formulas auto-recalculate.
 */
export function appendMaterialRow(
  workbook: IWorkbookDataT,
  input: AppendMaterialInputT,
): AppendMaterialResultT {
  const sheet = findSheet(workbook, MATERIALY_SHEET_NAME)
  if (!sheet) return { ok: false, reason: 'sheet-missing' }

  const layout = LAYOUTS[input.kind]
  const cellData = sheet.cellData

  let targetRow = -1
  for (let r = FIRST_DATA_ROW; r <= MAX_DATA_ROW; r++) {
    const row = cellData[r]
    if (isEmpty(row?.[layout.amountCol])) {
      targetRow = r
      break
    }
  }
  if (targetRow === -1) return { ok: false, reason: 'full' }

  if (!cellData[targetRow]) cellData[targetRow] = {}

  const dateSuffix = input.date ? ` [${input.date}]` : ''
  const descWithRef = `${input.description}${dateSuffix} #${input.transferId}`

  cellData[targetRow][layout.amountCol] = { v: input.amount }
  cellData[targetRow][layout.descCol] = { v: descWithRef }

  return {
    ok: true,
    rowIndex: targetRow,
    cellA1: `${colToA1(layout.amountCol)}${targetRow + 1}`,
  }
}
