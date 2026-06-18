import { google, sheets_v4 } from 'googleapis'
import { createServiceAccountJWT } from './auth'
import { serviceAccountEmail } from './sheet-access'
import {
  TRANSFERS_SUMMARY_TYPES,
  TRANSFER_TYPE_LABELS,
  CORRECTION_MOVED_LABEL,
} from '@/lib/constants/transfers'

// One row per transfer in a single long table, one app-managed tab per
// SheetTabConfigT. Columns are located by header text (normalized,
// keyword-contains) so the sheet layout — column order, extra columns, a summary
// block — can change without touching this code. The id column is the join key
// (one row per transferId). The row SYNC (append/read) only ever touches the
// mapped fields; the header, the SUMIF summary and all formatting are written
// once by setupTab.
export type SheetTabConfigT = {
  tabName: string
  header: string[]
  // Invariant: Object.keys(fieldMatchers)[i] must be the field that matches header[i]
  // — field order drives cell-write order and column-letter derivation.
  fieldMatchers: Record<string, (h: string) => boolean>
  includeGrandTotal: boolean // RAZEM + =SUM(amount-col) — expenses only
  dataColWidths: number[]
}

// A row's cell values keyed by config field name; `transferId` doubles as the
// id column value.
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

// PL labels for the transfers tab's per-type SUMIF summary, in tab order. Driven
// by the FIXED summary layout (incl. a now-zero Korekta column), NOT the routing
// list — so a tab rebuild never shifts columns out from under existing formulas.
export const transferSummaryKeys = (): string[] =>
  TRANSFERS_SUMMARY_TYPES.map((t) =>
    t === 'CORRECTION' ? CORRECTION_MOVED_LABEL : TRANSFER_TYPE_LABELS[t],
  )

const fieldsOf = (cfg: SheetTabConfigT): string[] => Object.keys(cfg.fieldMatchers)
const colOf = (cfg: SheetTabConfigT, field: string): string =>
  columnLetter(fieldsOf(cfg).indexOf(field))

// Open-ended rows (A:Z, no row cap): a kosztorys can hold any number of rows,
// and a fixed cap would make reads silently truncate — the reconciler would
// then see un-read rows as orphans and delete them. Google trims trailing empties,
// so an open range stays cheap. Columns are bounded at Z: the data block plus the
// summary fit well within, and Z leaves ample room.
const tabRange = (cfg: SheetTabConfigT) => `'${cfg.tabName}'!A:Z`
const MAX_HEADER_SCAN_ROWS = 15

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

// Build the summary row values: optional RAZEM (grand total) + one SUMIF per
// summary key. Uses full-column ranges (C:C / E:E, derived from the config's typ
// and amount columns) and a LITERAL criterion — NOT `C2:C` + a label-cell
// reference like the old form did. That older form drifted: any row insert or a
// sort spanning the summary columns shifted the formula and rewrote its criterion
// to an empty cell, zeroing every per-type total. Full columns survive inserts
// (the header text is ignored by SUM/SUMIF), and a literal criterion can't come
// unstuck from a moved label cell. argSep follows the sheet locale. Key names are
// double-quote-escaped for the formula string.
export function buildTabSummary(
  cfg: SheetTabConfigT,
  summaryKeys: string[],
  argSep: ';' | ',',
): { labels: string[]; totals: string[] } {
  const typCol = colOf(cfg, 'typ')
  const amountCol = colOf(cfg, 'amount')
  const labels = cfg.includeGrandTotal ? ['RAZEM', ...summaryKeys] : [...summaryKeys]
  const totals = cfg.includeGrandTotal ? [`=SUM(${amountCol}:${amountCol})`] : []
  for (const t of summaryKeys) {
    const escaped = t.replace(/"/g, '""')
    totals.push(
      `=SUMIF(${typCol}:${typCol}${argSep} "${escaped}"${argSep} ${amountCol}:${amountCol})`,
    )
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

type HeaderMapT = { headerRow: number; cols: Record<string, number> }

// Find the header row (first row, within the top MAX_HEADER_SCAN_ROWS, that
// contains all mapped fields) and each field's column index. Fail-loud: throws if
// no such row exists, rather than guessing and writing to the wrong column.
function resolveHeaders(cfg: SheetTabConfigT, grid: unknown[][]): HeaderMapT {
  const fields = fieldsOf(cfg)
  const limit = Math.min(grid.length, MAX_HEADER_SCAN_ROWS)
  for (let r = 0; r < limit; r++) {
    const row = grid[r] ?? []
    const cols: Record<string, number> = {}
    let found = 0
    for (const field of fields) {
      const idx = row.findIndex((cell) => cfg.fieldMatchers[field](normalize(cell)))
      if (idx >= 0) {
        cols[field] = idx
        found += 1
      }
    }
    if (found === fields.length) {
      // This is the header row. Reject it if any field's keyword matches more than
      // one column — findIndex would silently pick the leftmost and we'd then read
      // and write the wrong column (review T2.7). Fail loud so the owner renames it.
      for (const field of fields) {
        const count = row.filter((cell) => cfg.fieldMatchers[field](normalize(cell))).length
        if (count > 1) {
          throw new Error(
            `${cfg.tabName}: ambiguous header — ${count} columns match „${field}". Zmień nazwę dodatkowej kolumny.`,
          )
        }
      }
      return { headerRow: r + 1, cols }
    }
  }
  throw new Error(
    `${cfg.tabName}: header row not found — need columns for ${cfg.header.join(', ')}`,
  )
}

// Thrown when the tab itself is absent (Google reports "Unable to parse range").
// Callers that can self-heal (ensureTab + retry) or degrade (treat as empty)
// catch this specifically.
export class MissingTabError extends Error {}

async function readGrid(spreadsheetId: string, cfg: SheetTabConfigT): Promise<unknown[][]> {
  const sheets = getClient()
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: tabRange(cfg) })
    return (res.data.values ?? []) as unknown[][]
  } catch (err) {
    // Google returns "Unable to parse range" when the tab doesn't exist — turn
    // that into an actionable message instead of leaking the raw API error.
    if (String(err).includes('Unable to parse range')) {
      throw new MissingTabError(
        `Arkusz nie ma karty „${cfg.tabName}". Kliknij „Zresetuj wydatki inwestycyjne", aby ją utworzyć.`,
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
// `emptyIfMissing` degrades a missing tab to an empty map — used by preview paths
// that must not throw before the apply path has had a chance to create the tab.
export async function readTabTransferIds(
  spreadsheetId: string,
  cfg: SheetTabConfigT,
  opts: { emptyIfMissing?: boolean } = {},
): Promise<Map<number, number>> {
  let grid: unknown[][]
  try {
    grid = await readGrid(spreadsheetId, cfg)
  } catch (err) {
    if (opts.emptyIfMissing && err instanceof MissingTabError) return new Map()
    throw err
  }
  const { headerRow, cols } = resolveHeaders(cfg, grid)

  const map = new Map<number, number>()
  for (let r = headerRow; r < grid.length; r++) {
    const id = isTransferId(grid[r]?.[cols.id])
    if (id !== undefined) map.set(id, r + 1)
  }
  return map
}

// The mapped cells of one row as A1 value ranges at a known row number.
function cellDataForRow(
  cfg: SheetTabConfigT,
  input: TabRowInputT,
  cols: Record<string, number>,
  rowNumber: number,
) {
  const vals: Record<string, string | number> = { ...input, id: input.transferId }
  return fieldsOf(cfg).map((field) => ({
    range: `'${cfg.tabName}'!${columnLetter(cols[field])}${rowNumber}`,
    values: [[vals[field]]],
  }))
}

// The tab's numeric sheetId (gid), or undefined if the tab is missing.
async function tabGid(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  cfg: SheetTabConfigT,
): Promise<number | undefined> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  })
  return (
    (meta.data.sheets ?? []).find((s) => s.properties?.title === cfg.tabName)?.properties
      ?.sheetId ?? undefined
  )
}

// The single batched write path: upsert rows (overwrite by id where present,
// else append) and delete rows by id. Does ONE readGrid + at most two writes
// regardless of row count — so a full reconcile of N rows no longer costs
// O(N) Google API calls (review T4.1). Appends target an EXPLICITLY computed
// row (last mapped-column data row + 1) and go through values.batchUpdate —
// NOT values.append, which couldn't be used here: its table detection treats
// the adjacent summary column as part of the table and appends below the
// shared first-data row, leaving row 2 blank (review T2.1 + the live failure
// it caused). The computed-row + scan-all-mapped-columns approach keeps appends
// below any manual row sitting under the block (review T1.4). Removes touch
// only the data columns ([0, summary start)) so the summary survives, and
// run bottom-up so row numbers don't shift mid-batch.
export async function applyTabRowsBatch(
  spreadsheetId: string,
  cfg: SheetTabConfigT,
  upserts: TabRowInputT[],
  removeIds: number[] = [],
): Promise<{ added: number; updated: number; removed: number }> {
  const sheets = getClient()
  const grid = await readGrid(spreadsheetId, cfg)
  const { headerRow, cols } = resolveHeaders(cfg, grid)
  const fields = fieldsOf(cfg)

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
  // columns deliberately ignores the summary block (col >= summary start): the
  // summary total shares a row with the first data row, and counting it would skip
  // that row and leave a blank. (We can't use values.append for the same reason —
  // its table detection treats the adjacent summary column as part of the table and
  // appends below it, leaving the first data row blank.)
  const maxCol = Math.max(...fields.map((f) => cols[f]))
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
    ...updates.flatMap((row) =>
      cellDataForRow(cfg, row, cols, idToRow.get(row.transferId) as number),
    ),
    ...appends.flatMap((row, i) => cellDataForRow(cfg, row, cols, lastDataRow + 1 + i)),
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
    const gid = await tabGid(sheets, spreadsheetId, cfg)
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
                endColumnIndex: cfg.header.length,
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

// Delete the single row carrying `transferId`. Used when an edit reassigns a
// transfer to a different investment (dropped from the OLD sheet) or a cancellation
// removes its row. Delegates to the batched path (one scoped deleteRange, summary
// preserved). No-op if the id isn't on this sheet, or the tab is missing.
export async function removeTabRow(
  spreadsheetId: string,
  cfg: SheetTabConfigT,
  transferId: number,
): Promise<void> {
  await applyTabRowsBatch(spreadsheetId, cfg, [], [transferId])
}

// Color that brands each summary key across the sheet (row tint + summary
// swatch), keyed by name. The three core expense types keep their hand-picked
// brand colors; any other key gets a stable, distinct color derived from its name
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
  // Deterministic name → palette index (small string hash), so the same key
  // always maps to the same color across syncs.
  let hash = 0
  for (let i = 0; i < typeName.length; i++) hash = (hash * 31 + typeName.charCodeAt(i)) | 0
  return AUTO_COLORS[Math.abs(hash) % AUTO_COLORS.length]
}

const MONEY_PATTERN = '#,##0.00 "zł"'
const HEADER_BG: RgbT = { red: 0.17, green: 0.24, blue: 0.31 }
const RAZEM_BG: RgbT = { red: 0.93, green: 0.94, blue: 0.95 }
const WHITE: RgbT = { red: 1, green: 1, blue: 1 }

// Tab layout (0-indexed rows): row 1 holds a baked-in user-facing banner warning
// that manual edits to this tab are overwritten on next sync, row 2 holds the
// column headers, data starts at row 3. The banner is part of the table on purpose
// — owners who open the sheet in a new tab (bypassing the in-app notice) still
// see it. Reads/writes are header-driven (`resolveHeaders` scans for the header
// row by keyword), so shifting the header down doesn't affect the sync paths —
// only `setupTab`'s formatting math has to know these positions.
const BANNER_ROW = 0
const HEADER_ROW = 1
const DATA_START_ROW = 2

const BANNER_TEXT =
  '⚠ Edycje rób w aplikacji — ręczne zmiany w tej zakładce zostaną nadpisane przy następnej synchronizacji.'
const BANNER_BG: RgbT = { red: 1, green: 0.949, blue: 0.8 } // soft amber, contrasts the dark header below

// Attach (or reset) an app-managed tab on an existing spreadsheet: ensure the tab
// exists, write the header + summary (optional RAZEM + per-key SUMIF), then style
// it (frozen bold header, currency amounts, per-key whole-row color, matching
// summary swatches). Does NOT create a new file, so it works within
// service-account Drive limits. Re-runnable: clears values and drops prior
// conditional rules first.
export async function setupTab(
  spreadsheetId: string,
  cfg: SheetTabConfigT,
  summaryKeys: string[],
): Promise<void> {
  const sheets = getClient()

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      'properties.locale,sheets(properties(sheetId,title),conditionalFormats,protectedRanges(protectedRangeId),tables(tableId))',
  })
  const argSep = formulaArgSeparator(meta.data.properties?.locale ?? undefined)
  const existing = (meta.data.sheets ?? []).find((s) => s.properties?.title === cfg.tabName)
  let sheetId = existing?.properties?.sheetId ?? undefined
  const priorRuleCount = existing?.conditionalFormats?.length ?? 0
  const priorProtectedRangeIds = (existing?.protectedRanges ?? [])
    .map((p) => p.protectedRangeId)
    .filter((id): id is number => id != null)
  // Google Sheets' Tables feature (Data → Convert to table; sometimes auto-applied)
  // hijacks the tab: row 1 becomes the Table's column-name header (our banner text
  // ends up named as column 1), column types are enforced over cell-level number
  // formats (the T1.5 column-type collision), merges across the Table's range are
  // disallowed, and the Table's row colouring fights conditional formats. We never
  // create a Table here — but if someone (or Google's UI auto-promotion) added one,
  // remove it first so our formatting/protection actually take effect.
  const priorTableIds = (existing?.tables ?? [])
    .map((t) => t.tableId)
    .filter((id): id is string => !!id)
  if (sheetId == null) {
    const added = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: cfg.tabName } } }] },
    })
    sheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined
    if (sheetId == null) {
      // Never fall back to 0 — that is the gid of the spreadsheet's first tab, so
      // every formatting request below would silently target the wrong sheet.
      throw new Error('setupTab: addSheet returned no sheetId')
    }
  }

  // Clear the whole tab so it's a clean template. This is deliberately
  // destructive of data rows: after setup the owner re-syncs, and the resync
  // re-appends every row with the CURRENT type names — which is what heals a
  // renamed type (stale typ strings can't survive to break the per-type SUMIF
  // totals or the row coloring).
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: tabRange(cfg) })

  // Layout: row 1 banner (warning text, merged across the full table), row 2 header
  // + summary labels, row 3+ data — and row 3 also holds the summary totals. So
  // the totals stay visually aligned with the first data row, just like before the
  // banner landed. `applyTabRowsBatch` computes the append row explicitly
  // (last mapped-column data row + 1) rather than using Google `values.append` —
  // append's table detection would treat the adjacent summary cell as table content
  // and place the first row at the row AFTER the totals, leaving the data-totals
  // alignment broken. The summary is a small 2-row table starting right after the
  // data block: optional RAZEM + one column per key, the total UNDER its label.
  // Separator follows the sheet's locale.
  const { labels, totals } = buildTabSummary(cfg, summaryKeys, argSep)

  const summaryStartCol = cfg.header.length
  const summaryStart = columnLetter(summaryStartCol)
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        // Write the banner BEFORE we mergeCells below — merge keeps the top-left
        // value and discards the rest, so the order matters.
        { range: `'${cfg.tabName}'!A${BANNER_ROW + 1}`, values: [[BANNER_TEXT]] },
        { range: `'${cfg.tabName}'!A${HEADER_ROW + 1}`, values: [cfg.header] },
        { range: `'${cfg.tabName}'!${summaryStart}${HEADER_ROW + 1}`, values: [labels] },
        { range: `'${cfg.tabName}'!${summaryStart}${DATA_START_ROW + 1}`, values: [totals] },
      ],
    },
  })

  const requests: sheets_v4.Schema$Request[] = []

  // Delete pre-existing Tables FIRST — see the priorTableIds comment above; any
  // formatting/merge/freeze request that runs while a Table still owns the range
  // is silently overridden by the Table.
  for (const tableId of priorTableIds) {
    requests.push({ deleteTable: { tableId } })
  }

  // Drop prior protected ranges so a re-run doesn't stack duplicates.
  for (const protectedRangeId of priorProtectedRangeIds) {
    requests.push({ deleteProtectedRange: { protectedRangeId } })
  }

  // Drop prior conditional rules (reverse order keeps indices valid) so a re-run
  // doesn't stack duplicate row-coloring rules.
  for (let i = priorRuleCount - 1; i >= 0; i--) {
    requests.push({ deleteConditionalFormatRule: { sheetId, index: i } })
  }

  // Freeze the banner + header rows together (so both stay visible on scroll).
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 2 } },
      fields: 'gridProperties.frozenRowCount',
    },
  })

  // Banner row — merge across the WHOLE table (data block + summary block)
  // so the warning visually owns the top of the tab.
  const tableEndColIdx = summaryStartCol + labels.length
  requests.push({
    mergeCells: {
      range: {
        sheetId,
        startRowIndex: BANNER_ROW,
        endRowIndex: BANNER_ROW + 1,
        startColumnIndex: 0,
        endColumnIndex: tableEndColIdx,
      },
      mergeType: 'MERGE_ALL',
    },
  })
  // Banner styling — soft amber, bold, centred, wrap-on so the text grows the row
  // height automatically if the table is narrow.
  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: BANNER_ROW,
        endRowIndex: BANNER_ROW + 1,
        startColumnIndex: 0,
        endColumnIndex: tableEndColIdx,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: BANNER_BG,
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'WRAP',
          textFormat: { bold: true },
        },
      },
      fields:
        'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
    },
  })

  // Header row (data block) — dark background, bold white, centered.
  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: HEADER_ROW,
        endRowIndex: HEADER_ROW + 1,
        startColumnIndex: 0,
        endColumnIndex: cfg.header.length,
      },
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

  // Currency format on the kwota column data rows (row 3 down).
  const amountColIdx = fieldsOf(cfg).indexOf('amount')
  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: DATA_START_ROW,
        startColumnIndex: amountColIdx,
        endColumnIndex: amountColIdx + 1,
      },
      cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: MONEY_PATTERN } } },
      fields: 'userEnteredFormat.numberFormat',
    },
  })

  // Per key: whole-row tint (conditional) + bold solid swatch on its label+total.
  // The rule applies to the data range (row 3+); the formula's row anchor matches
  // the range's first row (DATA_START_ROW + 1 = 3), so `=$C3=<label cell>` evaluates
  // per data row against the key's summary label (now sitting at row 2).
  const typCol = colOf(cfg, 'typ')
  summaryKeys.forEach((typeName, i) => {
    const rgb = hexToRgb(colorFor(typeName))
    const labelColIdx = summaryStartCol + (cfg.includeGrandTotal ? 1 : 0) + i
    const labelCellAbs = `$${columnLetter(labelColIdx)}$${HEADER_ROW + 1}`
    requests.push({
      addConditionalFormatRule: {
        index: 0,
        rule: {
          ranges: [
            {
              sheetId,
              startRowIndex: DATA_START_ROW,
              startColumnIndex: 0,
              endColumnIndex: cfg.header.length,
            },
          ],
          booleanRule: {
            condition: {
              type: 'CUSTOM_FORMULA',
              values: [{ userEnteredValue: `=$${typCol}${DATA_START_ROW + 1}=${labelCellAbs}` }],
            },
            format: { backgroundColor: tint(rgb) },
          },
        },
      },
    })
    // Summary swatch (label + total) uses the SAME tint as the key's rows, so
    // the total visibly matches its rows. Bold, dark text (tint is light). Covers
    // the label row (HEADER_ROW) AND the totals row (DATA_START_ROW).
    const swatchBg = tint(rgb)
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: HEADER_ROW,
          endRowIndex: DATA_START_ROW + 1,
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

  // RAZEM label (HEADER_ROW) + total (DATA_START_ROW) — neutral, bold.
  if (cfg.includeGrandTotal) {
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: HEADER_ROW,
          endRowIndex: DATA_START_ROW + 1,
          startColumnIndex: summaryStartCol,
          endColumnIndex: summaryStartCol + 1,
        },
        cell: {
          userEnteredFormat: { backgroundColor: RAZEM_BG, textFormat: { bold: true } },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    })
  }

  // Totals row across the summary block (DATA_START_ROW) — bold + currency.
  requests.push({
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: DATA_START_ROW,
        endRowIndex: DATA_START_ROW + 1,
        startColumnIndex: summaryStartCol,
        endColumnIndex: summaryStartCol + labels.length,
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

  // Explicit widths for the data block. Auto-resize can't be used here: setup
  // runs on a freshly-cleared tab (no data rows yet), so it would shrink columns
  // to the short header text.
  cfg.dataColWidths.forEach((pixelSize, idx) => {
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
  // and each key column for its (longer) label.
  const SUMMARY_RAZEM_WIDTH = 150
  const SUMMARY_TYPE_WIDTH = 190
  for (let i = 0; i < labels.length; i++) {
    const idx = summaryStartCol + i
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
        properties: {
          pixelSize: cfg.includeGrandTotal && i === 0 ? SUMMARY_RAZEM_WIDTH : SUMMARY_TYPE_WIDTH,
        },
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

// Non-destructive counterpart to setupTab: build the tab ONLY when it's missing,
// and leave it completely untouched if it already exists. Used on link, where the
// owner may be attaching a sheet that already holds a populated tab — silently
// wiping it (what setupTab does) would destroy hand-entered data with no
// confirmation. The destructive wipe-and-rebuild stays behind the explicit
// "Zresetuj wydatki inwestycyjne" button. Returns whether it created the tab.
export async function ensureTab(
  spreadsheetId: string,
  cfg: SheetTabConfigT,
  summaryKeys: string[],
): Promise<{ created: boolean }> {
  const sheets = getClient()
  const gid = await tabGid(sheets, spreadsheetId, cfg)
  if (gid != null) return { created: false }
  // Tab is absent → setupTab builds it on a fresh (empty) tab, so its internal
  // values.clear has nothing to destroy.
  await setupTab(spreadsheetId, cfg, summaryKeys)
  return { created: true }
}
