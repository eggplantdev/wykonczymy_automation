import { google, sheets_v4 } from 'googleapis'
import { createServiceAccountJWT } from './auth'

// One row per investment expense in a single long table. Columns are located by
// header text (normalized, keyword-contains) so the sheet layout — column order,
// extra columns, a summary block — can change without touching this code.
// The id column is the join key (one row per transferId). The Suma/summary cells
// are the owner's formulas; the app only ever writes the seven mapped fields.
export type MaterialRowInputT = {
  transferId: number
  date: string
  typ: string
  description: string
  amount: number
  category: string
  note: string
}

const MATERIALY_TAB = 'materiały '
const TAB_RANGE = `'${MATERIALY_TAB}'!A1:Z1000`
const MAX_HEADER_SCAN_ROWS = 15

// Header the setup writes. The sync locates columns by keyword, so these exact
// labels aren't load-bearing for reads — but they must keep their keywords.
const MATERIALY_HEADER = [
  'id',
  'data',
  'typ wydatku inwestycyjnego',
  'opis',
  'kwota',
  'kategoria',
  'notatka',
]

const FIELD_MATCHERS = {
  id: (h: string) => h === 'id',
  date: (h: string) => h.includes('data'),
  typ: (h: string) => h.includes('typ'),
  description: (h: string) => h.includes('opis'),
  amount: (h: string) => h.includes('kwota'),
  category: (h: string) => h.includes('kategoria'),
  note: (h: string) => h.includes('notatka'),
} as const
type FieldT = keyof typeof FIELD_MATCHERS
const FIELDS = Object.keys(FIELD_MATCHERS) as FieldT[]

const normalize = (cell: unknown): string =>
  String(cell ?? '')
    .trim()
    .toLowerCase()

function columnLetter(index: number): string {
  let n = index + 1
  let letter = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

function getClient(): sheets_v4.Sheets {
  const auth = createServiceAccountJWT(['https://www.googleapis.com/auth/spreadsheets'])
  return google.sheets({ version: 'v4', auth })
}

type HeaderMapT = { headerRow: number; cols: Record<FieldT, number> }

// Find the header row (first row, within the top MAX_HEADER_SCAN_ROWS, that
// contains all seven fields) and each field's column index. Fail-loud: throws if
// no such row exists, rather than guessing and writing to the wrong column.
function resolveHeaders(grid: unknown[][]): HeaderMapT {
  const limit = Math.min(grid.length, MAX_HEADER_SCAN_ROWS)
  for (let r = 0; r < limit; r++) {
    const row = grid[r] ?? []
    const cols = {} as Record<FieldT, number>
    let found = 0
    for (const field of FIELDS) {
      const idx = row.findIndex((cell) => FIELD_MATCHERS[field](normalize(cell)))
      if (idx >= 0) {
        cols[field] = idx
        found += 1
      }
    }
    if (found === FIELDS.length) return { headerRow: r + 1, cols }
  }
  throw new Error(
    'materiały: header row not found — need columns for id, data, typ, opis, kwota, kategoria, notatka',
  )
}

async function readGrid(spreadsheetId: string): Promise<unknown[][]> {
  const sheets = getClient()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: TAB_RANGE })
  return (res.data.values ?? []) as unknown[][]
}

function isTransferId(cell: unknown): number | undefined {
  if (cell == null) return undefined
  const trimmed = String(cell).trim()
  if (trimmed === '') return undefined
  const id = Number(trimmed)
  return Number.isFinite(id) ? id : undefined
}

// Map<transferId, sheetRowNumber>, scanning the id column below the header row.
export async function readMaterialyTransferIds(
  spreadsheetId: string,
): Promise<Map<number, number>> {
  const grid = await readGrid(spreadsheetId)
  const { headerRow, cols } = resolveHeaders(grid)

  const map = new Map<number, number>()
  for (let r = headerRow; r < grid.length; r++) {
    const id = isTransferId(grid[r]?.[cols.id])
    if (id !== undefined) map.set(id, r + 1)
  }
  return map
}

export async function appendMaterialRow(
  spreadsheetId: string,
  input: MaterialRowInputT,
): Promise<{ rowIndex: number }> {
  const sheets = getClient()
  const grid = await readGrid(spreadsheetId)
  const { headerRow, cols } = resolveHeaders(grid)

  // Next empty row = one past the last row carrying an id below the header.
  let lastDataRow = headerRow
  for (let r = headerRow; r < grid.length; r++) {
    if (isTransferId(grid[r]?.[cols.id]) !== undefined) lastDataRow = r + 1
  }
  const rowIndex = lastDataRow + 1

  const valueByField: Record<FieldT, string | number> = {
    id: input.transferId,
    date: input.date,
    typ: input.typ,
    description: input.description,
    amount: input.amount,
    category: input.category,
    note: input.note,
  }
  // Write only the mapped cells — summary/other columns are never touched.
  const data = FIELDS.map((field) => ({
    range: `'${MATERIALY_TAB}'!${columnLetter(cols[field])}${rowIndex}`,
    values: [[valueByField[field]]],
  }))
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  })

  return { rowIndex }
}

export async function deleteMaterialRowByTransferId(
  spreadsheetId: string,
  transferId: number,
): Promise<{ deleted: boolean; rowIndex?: number }> {
  const sheets = getClient()
  const grid = await readGrid(spreadsheetId)
  const { headerRow, cols } = resolveHeaders(grid)

  for (let r = headerRow; r < grid.length; r++) {
    if (isTransferId(grid[r]?.[cols.id]) !== transferId) continue
    const rowIndex = r + 1
    // Clear only this expense's mapped field cells; leaves the row in place and
    // never touches summary columns.
    const data = FIELDS.map((field) => ({
      range: `'${MATERIALY_TAB}'!${columnLetter(cols[field])}${rowIndex}`,
      values: [['']],
    }))
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data },
    })
    return { deleted: true, rowIndex }
  }
  return { deleted: false }
}

// Attach (or reset) the materiały tab on an existing spreadsheet: ensure the tab
// exists, then write the RAZEM + per-type SUMIF summary and the header row. Does
// NOT create a new file, so it works within service-account Drive limits. The
// summary's per-type rows double as SUMIF criteria (label == matched typ).
export async function setupMaterialyTab(
  spreadsheetId: string,
  expenseTypes: string[],
): Promise<void> {
  const sheets = getClient()

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(title))',
  })
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === MATERIALY_TAB)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: MATERIALY_TAB } } }] },
    })
  }

  // Clear any prior layout so this is a clean template.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: TAB_RANGE })

  // Summary occupies rows 1..(types+1); header on the next row; data after that.
  const headerRow = expenseTypes.length + 2
  const dataStart = headerRow + 1

  // Polish-locale sheets use ';' as the formula argument separator, not ','.
  const summary: (string | number)[][] = [['RAZEM', `=SUM(E${dataStart}:E)`]]
  expenseTypes.forEach((typ, i) => {
    const labelRow = i + 2 // sheet row holding this type's label (== SUMIF criterion)
    summary.push([typ, `=SUMIF(C${dataStart}:C; A${labelRow}; E${dataStart}:E)`])
  })

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `'${MATERIALY_TAB}'!A1`, values: summary },
        { range: `'${MATERIALY_TAB}'!A${headerRow}`, values: [MATERIALY_HEADER] },
      ],
    },
  })
}
