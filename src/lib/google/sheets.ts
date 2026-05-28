import { google, sheets_v4 } from 'googleapis'
import { createServiceAccountJWT } from './auth'
import { serviceAccountEmail } from './sheet-access'

// One row per investment expense in a single long table. Columns are located by
// header text (normalized, keyword-contains) so the sheet layout — column order,
// extra columns, a summary block — can change without touching this code.
// The id column is the join key (one row per transferId). The row SYNC
// (append/read) only ever touches the seven mapped fields; the header, the
// RAZEM/SUMIF summary and all formatting are written once by setupMaterialyTab.
export type MaterialRowInputT = {
  transferId: number
  date: string
  typ: string
  description: string
  amount: number
  category: string
  note: string
}

const MATERIALY_TAB = 'wydatki inwestycyjne (tylko do odczytu)'
// Open-ended rows (A:Z, no row cap): a kosztorys can hold any number of expense
// rows, and a fixed cap would make reads silently truncate — the reconciler would
// then see un-read rows as orphans and delete them. Google trims trailing empties,
// so an open range stays cheap. Columns are bounded at Z: data is A–G, the summary
// starts at H, and Z leaves ample room.
const TAB_RANGE = `'${MATERIALY_TAB}'!A:Z`
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

// Google Sheets uses the spreadsheet locale's list separator inside formula
// argument lists: locales whose decimal mark is a comma (pl_PL, most of the EU)
// use ';', period-decimal locales (en_US, …) use ','. Detect the decimal mark via
// Intl and pick accordingly, so a SUMIF written here parses on a non-PL sheet too.
// Defaults to ';' if the locale is unknown/unparseable (the Polish-sheet case).
export function formulaArgSeparator(locale: string | undefined): ';' | ',' {
  try {
    const decimal = new Intl.NumberFormat((locale ?? 'pl-PL').replace('_', '-'))
      .formatToParts(1.1)
      .find((p) => p.type === 'decimal')?.value
    return decimal === ',' ? ';' : ','
  } catch {
    return ';'
  }
}

// Build the summary row values: RAZEM (grand total) + one SUMIF per expense type.
// Uses full-column ranges (C:C / E:E) and a LITERAL type-name criterion — NOT
// `C2:C` + a label-cell reference like the old form did. That older form drifted:
// any row insert or a sort spanning the summary columns shifted the formula and
// rewrote its criterion to an empty cell, zeroing every per-type total. Full
// columns survive inserts (the header text is ignored by SUM/SUMIF), and a literal
// criterion can't come unstuck from a moved label cell. argSep follows the sheet
// locale. Type names are double-quote-escaped for the formula string.
export function buildMaterialySummary(
  expenseTypes: string[],
  argSep: ';' | ',',
): { labels: string[]; totals: string[] } {
  const labels = ['RAZEM', ...expenseTypes]
  const totals = ['=SUM(E:E)']
  for (const t of expenseTypes) {
    const escaped = t.replace(/"/g, '""')
    totals.push(`=SUMIF(C:C${argSep} "${escaped}"${argSep} E:E)`)
  }
  return { labels, totals }
}

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

type RgbT = { red: number; green: number; blue: number }

function hexToRgb(hex: string): RgbT {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return {
    red: parseInt(full.slice(0, 2), 16) / 255,
    green: parseInt(full.slice(2, 4), 16) / 255,
    blue: parseInt(full.slice(4, 6), 16) / 255,
  }
}

// Heavily-whitened version of a color for whole-row backgrounds, so dark text
// stays readable while the hue is still recognizable at a glance.
function tint(rgb: RgbT, amount = 0.82): RgbT {
  const mix = (c: number) => c + (1 - c) * amount
  return { red: mix(rgb.red), green: mix(rgb.green), blue: mix(rgb.blue) }
}

// Black or white text for a solid swatch, picked by perceived luminance.
function textOn(rgb: RgbT): RgbT {
  const lum = 0.299 * rgb.red + 0.587 * rgb.green + 0.114 * rgb.blue
  return lum > 0.6 ? { red: 0, green: 0, blue: 0 } : { red: 1, green: 1, blue: 1 }
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
    if (found === FIELDS.length) {
      // This is the header row. Reject it if any field's keyword matches more than
      // one column — findIndex would silently pick the leftmost and we'd then read
      // and write the wrong column (review T2.7). Fail loud so the owner renames it.
      for (const field of FIELDS) {
        const count = row.filter((cell) => FIELD_MATCHERS[field](normalize(cell))).length
        if (count > 1) {
          throw new Error(
            `${MATERIALY_TAB}: ambiguous header — ${count} columns match „${field}". Zmień nazwę dodatkowej kolumny.`,
          )
        }
      }
      return { headerRow: r + 1, cols }
    }
  }
  throw new Error(
    `${MATERIALY_TAB}: header row not found — need columns for id, data, typ, opis, kwota, kategoria, notatka`,
  )
}

async function readGrid(spreadsheetId: string): Promise<unknown[][]> {
  const sheets = getClient()
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: TAB_RANGE })
    return (res.data.values ?? []) as unknown[][]
  } catch (err) {
    // Google returns "Unable to parse range" when the tab doesn't exist — turn
    // that into an actionable message instead of leaking the raw API error.
    if (String(err).includes('Unable to parse range')) {
      throw new Error(
        `Arkusz nie ma karty „${MATERIALY_TAB}". Kliknij „Zresetuj zakładkę materiały", aby ją utworzyć.`,
      )
    }
    throw err
  }
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

// ── value-mapping helpers (shared by every write path) ──────────────────────
function valuesByField(input: MaterialRowInputT): Record<FieldT, string | number> {
  return {
    id: input.transferId,
    date: input.date,
    typ: input.typ,
    description: input.description,
    amount: input.amount,
    category: input.category,
    note: input.note,
  }
}

// The seven mapped cells of one row as A1 value ranges at a known row number.
function cellDataForRow(input: MaterialRowInputT, cols: Record<FieldT, number>, rowNumber: number) {
  const vals = valuesByField(input)
  return FIELDS.map((field) => ({
    range: `'${MATERIALY_TAB}'!${columnLetter(cols[field])}${rowNumber}`,
    values: [[vals[field]]],
  }))
}

// The Materiały tab's numeric sheetId (gid), or undefined if the tab is missing.
async function materialyTabGid(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<number | undefined> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  })
  return (
    (meta.data.sheets ?? []).find((s) => s.properties?.title === MATERIALY_TAB)?.properties
      ?.sheetId ?? undefined
  )
}

// The single batched write path: upsert rows (overwrite by id where present,
// else append) and delete rows by id. Does ONE readGrid + at most two writes
// regardless of row count — so a full reconcile of N expenses no longer costs
// O(N) Google API calls (review T4.1). Appends target an EXPLICITLY computed
// row (last mapped-column data row + 1) and go through values.batchUpdate —
// NOT values.append, which couldn't be used here: its table detection treats
// the adjacent summary column as part of the table and appends below the
// shared first-data row, leaving row 2 blank (review T2.1 + the live failure
// it caused). The computed-row + scan-all-mapped-columns approach keeps appends
// below any manual row sitting under the block (review T1.4). Removes touch
// only the data columns ([0, SUMMARY_START_COL)) so the summary survives, and
// run bottom-up so row numbers don't shift mid-batch.
export async function applyMaterialRowsBatch(
  spreadsheetId: string,
  upserts: MaterialRowInputT[],
  removeIds: number[] = [],
): Promise<{ added: number; updated: number; removed: number }> {
  const sheets = getClient()
  const grid = await readGrid(spreadsheetId)
  const { headerRow, cols } = resolveHeaders(grid)

  const idToRow = new Map<number, number>()
  for (let r = headerRow; r < grid.length; r++) {
    const id = isTransferId(grid[r]?.[cols.id])
    if (id !== undefined) idToRow.set(id, r + 1)
  }

  const updates = upserts.filter((u) => idToRow.has(u.transferId))
  const appends = upserts.filter((u) => !idToRow.has(u.transferId))

  // Append target = the row after the last one carrying data in the MAPPED columns
  // (A..maxCol). Scanning all mapped columns (not just the id column) makes appends
  // land below a manual row sitting under the block (T1.4). Scanning ONLY the mapped
  // columns deliberately ignores the summary block (col >= SUMMARY_START_COL): the
  // summary total shares a row with the first data row, and counting it would skip
  // that row and leave a blank. (We can't use values.append for the same reason —
  // its table detection treats the adjacent summary column as part of the table and
  // appends below it, leaving the first data row blank.)
  const maxCol = Math.max(...FIELDS.map((f) => cols[f]))
  let lastDataRow = headerRow
  for (let r = headerRow; r < grid.length; r++) {
    const row = grid[r] ?? []
    for (let c = 0; c <= maxCol; c++) {
      if (String(row[c] ?? '').trim() !== '') {
        lastDataRow = r + 1
        break
      }
    }
  }

  // Updates (at known rows) and appends (at sequential rows after the last data row)
  // are all plain cell writes — one batchUpdate regardless of count (T4.1).
  const data = [
    ...updates.flatMap((row) => cellDataForRow(row, cols, idToRow.get(row.transferId) as number)),
    ...appends.flatMap((row, i) => cellDataForRow(row, cols, lastDataRow + 1 + i)),
  ]
  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    })
  }

  // Removes: delete only the data columns of each row, bottom-up.
  const removeRows = removeIds
    .map((id) => idToRow.get(id))
    .filter((r): r is number => r !== undefined)
    .sort((a, b) => b - a)
  if (removeRows.length > 0) {
    const gid = await materialyTabGid(sheets, spreadsheetId)
    if (gid != null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: removeRows.map((rowNumber) => ({
            deleteRange: {
              range: {
                sheetId: gid,
                startRowIndex: rowNumber - 1,
                endRowIndex: rowNumber,
                startColumnIndex: 0,
                endColumnIndex: SUMMARY_START_COL,
              },
              shiftDimension: 'ROWS' as const,
            },
          })),
        },
      })
    }
  }

  return { added: appends.length, updated: updates.length, removed: removeRows.length }
}

// Delete the single row carrying `transferId`. Used when an edit reassigns an
// expense to a different investment (dropped from the OLD sheet) or a cancellation
// removes its row. Delegates to the batched path (one scoped deleteRange, summary
// preserved). No-op if the id isn't on this sheet, or the tab is missing.
export async function removeMaterialRow(spreadsheetId: string, transferId: number): Promise<void> {
  await applyMaterialRowsBatch(spreadsheetId, [], [transferId])
}

// Color that brands each expense type across the sheet (row tint + summary
// swatch), keyed by type name. The three core types keep their hand-picked brand
// colors; any other type gets a stable, distinct color derived from its name
// (review T5.3) — so a category added in the admin is auto-colored, not gray, with
// no code change or schema field.
const TYPE_COLORS: Record<string, string> = {
  'Materiały budowlane': '#3b82f6',
  'Materiały wykończeniowe': '#22c55e',
  'Pozostałe koszty': '#f59e0b',
}
// Palette for auto-assigned colors (distinct hues, all legible once tinted).
const AUTO_COLORS = ['#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#a3a635', '#ef4444']
const colorFor = (typeName: string): string => {
  if (TYPE_COLORS[typeName]) return TYPE_COLORS[typeName]
  // Deterministic name → palette index (small string hash), so the same category
  // always maps to the same color across syncs.
  let hash = 0
  for (let i = 0; i < typeName.length; i++) hash = (hash * 31 + typeName.charCodeAt(i)) | 0
  return AUTO_COLORS[Math.abs(hash) % AUTO_COLORS.length]
}

// Column H — directly after notatka (G). No gap between the data block and the
// summary (RAZEM sits next to notatka).
const SUMMARY_START_COL = 7
const MONEY_PATTERN = '#,##0.00 "zł"'
const HEADER_BG: RgbT = { red: 0.17, green: 0.24, blue: 0.31 }
const RAZEM_BG: RgbT = { red: 0.93, green: 0.94, blue: 0.95 }
const WHITE: RgbT = { red: 1, green: 1, blue: 1 }

// Attach (or reset) the expenses tab on an existing spreadsheet: ensure the tab
// exists, write the header + RAZEM/per-type SUMIF summary, then style it (frozen
// bold header, currency amounts, per-type whole-row color, matching summary
// swatches). Does NOT create a new file, so it works within service-account Drive
// limits. Re-runnable: clears values and drops prior conditional rules first.
export async function setupMaterialyTab(
  spreadsheetId: string,
  expenseTypes: string[],
): Promise<void> {
  const sheets = getClient()

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      'properties.locale,sheets(properties(sheetId,title),conditionalFormats,protectedRanges(protectedRangeId))',
  })
  const argSep = formulaArgSeparator(meta.data.properties?.locale ?? undefined)
  const existing = (meta.data.sheets ?? []).find((s) => s.properties?.title === MATERIALY_TAB)
  let sheetId = existing?.properties?.sheetId ?? undefined
  const priorRuleCount = existing?.conditionalFormats?.length ?? 0
  const priorProtectedRangeIds = (existing?.protectedRanges ?? [])
    .map((p) => p.protectedRangeId)
    .filter((id): id is number => id != null)
  if (sheetId == null) {
    const added = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: MATERIALY_TAB } } }] },
    })
    sheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined
    if (sheetId == null) {
      // Never fall back to 0 — that is the gid of the spreadsheet's first tab, so
      // every formatting request below would silently target the wrong sheet.
      throw new Error('setupMaterialyTab: addSheet returned no sheetId')
    }
  }

  // Clear the whole tab so it's a clean template. This is deliberately
  // destructive of data rows: after setup the owner re-syncs, and the resync
  // re-appends every row with the CURRENT expense-category names — which is what
  // heals a renamed type (stale typ strings can't survive to break the per-type
  // SUMIF totals or the row coloring).
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: TAB_RANGE })

  // Header at row 1, data from row 2 — a clean A:G block you can date-filter. The
  // first data row (row 2) shares its row with the summary totals, which sit in
  // columns H+ (A:G stay free for data). `applyMaterialRowsBatch` computes the append
  // row explicitly (last mapped-column data row + 1) rather than using Google
  // `values.append` — append's table detection would treat the adjacent summary cell
  // as table content and place the first row at row 3, leaving row 2's A:G blank. The
  // summary is a small 2-row table starting at column H: RAZEM + one column per type,
  // the total UNDER its label. Separator follows the sheet's locale.
  const { labels, totals } = buildMaterialySummary(expenseTypes, argSep)

  const summaryStart = columnLetter(SUMMARY_START_COL)
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `'${MATERIALY_TAB}'!A1`, values: [MATERIALY_HEADER] },
        { range: `'${MATERIALY_TAB}'!${summaryStart}1`, values: [labels] },
        { range: `'${MATERIALY_TAB}'!${summaryStart}2`, values: [totals] },
      ],
    },
  })

  const requests: sheets_v4.Schema$Request[] = []

  // Drop prior protected ranges so a re-run doesn't stack duplicates.
  for (const protectedRangeId of priorProtectedRangeIds) {
    requests.push({ deleteProtectedRange: { protectedRangeId } })
  }

  // Drop prior conditional rules (reverse order keeps indices valid) so a re-run
  // doesn't stack duplicate row-coloring rules.
  for (let i = priorRuleCount - 1; i >= 0; i--) {
    requests.push({ deleteConditionalFormatRule: { sheetId, index: i } })
  }

  // Freeze the header row.
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount',
    },
  })

  // Header row A1:G1 — dark background, bold white, centered.
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
      cell: {
        userEnteredFormat: {
          backgroundColor: HEADER_BG,
          horizontalAlignment: 'CENTER',
          textFormat: { bold: true, foregroundColor: WHITE },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)',
    },
  })

  // Currency format on the kwota column (E) data rows.
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: MONEY_PATTERN } } },
      fields: 'userEnteredFormat.numberFormat',
    },
  })

  // Per type: whole-row tint (conditional) + bold solid swatch on its label+total.
  expenseTypes.forEach((typeName, i) => {
    const rgb = hexToRgb(colorFor(typeName))
    const labelColIdx = SUMMARY_START_COL + 1 + i
    const labelCellAbs = `$${columnLetter(labelColIdx)}$1`
    requests.push({
      addConditionalFormatRule: {
        index: 0,
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 }],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: `=$C2=${labelCellAbs}` }],
            },
            format: { backgroundColor: tint(rgb) },
          },
        },
      },
    })
    // Summary swatch (label + total) uses the SAME tint as the type's rows, so
    // the total visibly matches its rows. Bold, dark text (tint is light).
    const swatchBg = tint(rgb)
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 2,
          startColumnIndex: labelColIdx,
          endColumnIndex: labelColIdx + 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: swatchBg,
            textFormat: { bold: true, foregroundColor: textOn(swatchBg) },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    })
  })

  // RAZEM label + total — neutral, bold.
  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex: 2,
        startColumnIndex: SUMMARY_START_COL,
        endColumnIndex: SUMMARY_START_COL + 1,
      },
      cell: {
        userEnteredFormat: { backgroundColor: RAZEM_BG, textFormat: { bold: true } },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  })

  // Totals row (H2 across the summary) — bold + currency.
  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: 1,
        endRowIndex: 2,
        startColumnIndex: SUMMARY_START_COL,
        endColumnIndex: SUMMARY_START_COL + 1 + expenseTypes.length,
      },
      cell: {
        userEnteredFormat: {
          numberFormat: { type: 'NUMBER', pattern: MONEY_PATTERN },
          textFormat: { bold: true },
        },
      },
      fields: 'userEnteredFormat(numberFormat,textFormat)',
    },
  })

  // Explicit widths for the data block A–G. Auto-resize can't be used here: setup
  // runs on a freshly-cleared tab (no data rows yet), so it would shrink columns
  // to the short header text. Order: id, data, typ, opis, kwota, kategoria, notatka.
  const DATA_COL_WIDTHS = [60, 100, 200, 240, 110, 140, 180]
  DATA_COL_WIDTHS.forEach((pixelSize, idx) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
        properties: { pixelSize },
        fields: 'pixelSize',
      },
    })
  })

  // Explicit widths for the summary block. Auto-resize is wrong here: setup runs on
  // a freshly-cleared tab, so the totals compute to 0 ("0,00 zł") and auto-size makes
  // the columns too narrow for the real totals once data lands — RAZEM (the grand
  // total, the largest number) was the worst-hit. Size RAZEM for a big currency value
  // and each type column for its (longer) label.
  const SUMMARY_RAZEM_WIDTH = 150
  const SUMMARY_TYPE_WIDTH = 190
  for (let i = 0; i < 1 + expenseTypes.length; i++) {
    const idx = SUMMARY_START_COL + i
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
        properties: { pixelSize: i === 0 ? SUMMARY_RAZEM_WIDTH : SUMMARY_TYPE_WIDTH },
        fields: 'pixelSize',
      },
    })
  }

  // Read-only protection: lock the whole tab so only the service account (the
  // app) can edit it — the data is app-managed/one-way. Caveat: the file *owner*
  // can always bypass a protected range; this hard-blocks team collaborators.
  requests.push({
    addProtectedRange: {
      protectedRange: {
        range: { sheetId },
        description: 'Tylko do odczytu — synchronizowane z aplikacją',
        warningOnly: false,
        editors: { users: [serviceAccountEmail()] },
      },
    },
  })

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}
