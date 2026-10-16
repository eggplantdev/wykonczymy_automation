import { sheets_v4 } from 'googleapis'
import { getWritableSheetsClient } from './writable-sheets-client'
import { getReadonlySheetsClient } from './readonly-sheets-client'
import {
  columnLetter,
  colOf,
  fieldsOf,
  normalize,
  tabRange,
  MAX_HEADER_SCAN_ROWS,
  type SheetTabConfigT,
  type TabRowInputT,
} from './sheet-configs'
import { buildTabSummary, formulaArgSeparator } from './sheet-summary'
import {
  colorFor,
  hexToRgb,
  textOn,
  tint,
  BANNER_BG,
  BANNER_ROW,
  BANNER_TEXT,
  DATA_START_ROW,
  HEADER_BG,
  HEADER_ROW,
  MONEY_PATTERN,
  RAZEM_BG,
  WHITE,
} from './sheet-format'

export {
  EXPENSES_TAB_CONFIG,
  SETTLED_TAB_CONFIG,
  TRANSFERS_TAB_CONFIG,
  transferSummaryKeys,
  type SheetTabConfigT,
  type TabRowInputT,
} from './sheet-configs'
export { buildTabSummary, formulaArgSeparator } from './sheet-summary'

type HeaderMapT = { headerRow: number; cols: Record<string, number> }

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
      // findIndex would silently pick the leftmost and we'd then read and write the wrong column
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

class MissingTabError extends Error {}

// The client is a parameter because the WRITE path must read with the same account it writes
// with: two accounts holding the sheet is now the norm, but requiring both for one write would
// make a sheet shared with only the Editor fail its own sync — silently, behind sheets-sync's catch.
async function readGrid(
  spreadsheetId: string,
  cfg: SheetTabConfigT,
  sheets: sheets_v4.Sheets = getReadonlySheetsClient(),
): Promise<unknown[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: tabRange(cfg) })
    return (res.data.values ?? []) as unknown[][]
  } catch (err) {
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

export async function applyTabRowsBatch(
  spreadsheetId: string,
  cfg: SheetTabConfigT,
  upserts: TabRowInputT[],
  removeIds: number[] = [],
): Promise<{ added: number; updated: number; removed: number }> {
  const sheets = getWritableSheetsClient()
  const grid = await readGrid(spreadsheetId, cfg, sheets)
  const { headerRow, cols } = resolveHeaders(cfg, grid)
  const fields = fieldsOf(cfg)

  const idToRow = new Map<number, number>()
  for (let r = headerRow; r < grid.length; r++) {
    const id = isTransferId(grid[r]?.[cols.id])
    if (id !== undefined) idToRow.set(id, r + 1)
  }

  const updates = upserts.filter((u) => idToRow.has(u.transferId))
  const appends = upserts.filter((u) => !idToRow.has(u.transferId))

  // We can't use values.append — its table detection treats the adjacent summary column as part
  // of the table and appends below it, leaving the first data row blank.
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

export async function removeTabRow(
  spreadsheetId: string,
  cfg: SheetTabConfigT,
  transferId: number,
): Promise<void> {
  try {
    await applyTabRowsBatch(spreadsheetId, cfg, [], [transferId])
  } catch (err) {
    if (err instanceof MissingTabError) return
    throw err
  }
}

// Does NOT create a new file, so it works within service-account Drive limits.
export async function setupTab(
  spreadsheetId: string,
  cfg: SheetTabConfigT,
  summaryKeys: string[],
): Promise<void> {
  const sheets = getWritableSheetsClient()

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

  // This is deliberately destructive of data rows: after setup the owner re-syncs, and the resync
  // re-appends every row with the CURRENT type names — which is what heals a renamed type.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: tabRange(cfg) })

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

  // any formatting/merge/freeze request that runs while a Table still owns the range
  // is silently overridden by the Table.
  for (const tableId of priorTableIds) {
    requests.push({ deleteTable: { tableId } })
  }

  for (const protectedRangeId of priorProtectedRangeIds) {
    requests.push({ deleteProtectedRange: { protectedRangeId } })
  }

  for (let i = priorRuleCount - 1; i >= 0; i--) {
    requests.push({ deleteConditionalFormatRule: { sheetId, index: i } })
  }

  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 2 } },
      fields: 'gridProperties.frozenRowCount',
    },
  })

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

  // the formula's row anchor matches the range's first row (DATA_START_ROW + 1 = 3), so
  // `=$C3=<label cell>` evaluates per data row against the key's summary label.
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

  // Auto-resize can't be used here: setup runs on a freshly-cleared tab (no data rows yet), so it
  // would shrink columns to the short header text.
  cfg.dataColWidths.forEach((pixelSize, idx) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: idx, endIndex: idx + 1 },
        properties: { pixelSize },
        fields: 'pixelSize',
      },
    })
  })

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

  // A hard block (warningOnly:false + service-account-only editors) also disabled tab ops
  // (rename/hide/move) for every non-owner, blocking the team.
  requests.push({
    addProtectedRange: {
      protectedRange: {
        range: { sheetId },
        description: 'Tylko do odczytu — synchronizowane z aplikacją',
        warningOnly: true,
      },
    },
  })

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

// Used on link, where the owner may be attaching a sheet that already holds a populated tab —
// silently wiping it (what setupTab does) would destroy hand-entered data with no confirmation.
export async function ensureTab(
  spreadsheetId: string,
  cfg: SheetTabConfigT,
  summaryKeys: string[] | (() => string[] | Promise<string[]>),
): Promise<{ created: boolean }> {
  const sheets = getReadonlySheetsClient()
  const gid = await tabGid(sheets, spreadsheetId, cfg)
  if (gid != null) return { created: false }
  const keys = typeof summaryKeys === 'function' ? await summaryKeys() : summaryKeys
  await setupTab(spreadsheetId, cfg, keys)
  return { created: true }
}
