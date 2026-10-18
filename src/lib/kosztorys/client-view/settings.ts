import {
  CLIENT_DOCUMENT_COLUMNS,
  PREVIEW_VISIBLE_COLUMNS,
} from '@/lib/kosztorys/client-view/columns'
import {
  orderDocumentKeys,
  sanitizeDocumentRanks,
} from '@/lib/kosztorys/columns/document-column-order'
import {
  resolveHiddenColumns,
  toHiddenColumnMap,
  type HiddenColumnMapT,
} from '@/lib/kosztorys/columns/document-column-visibility'
import { STAGES_COLUMN_GROUP, STAGE_VALUE_NET_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'
import type { ColumnRanksT } from '@/lib/table/column-order'

export type ClientViewSettingsT = {
  hiddenColumns: string[]
  hideEmptyRows: boolean
  columnRanks: ColumnRanksT
}

const DEFAULT_VISIBLE_COLUMNS: ReadonlySet<string> = new Set([
  'description',
  'plannedQty',
  'currentPlannedQty',
  'unit',
  'price',
  'plannedNet',
  'stageQtySum',
  'net',
  STAGES_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  'donePercent',
])

const CLIENT_DEFAULT_HIDDEN_COLUMNS: ReadonlySet<string> = new Set(
  [...PREVIEW_VISIBLE_COLUMNS].filter((key) => !DEFAULT_VISIBLE_COLUMNS.has(key)),
)

const DEFAULT_SETTINGS: ClientViewSettingsT = {
  hiddenColumns: [...CLIENT_DEFAULT_HIDDEN_COLUMNS],
  hideEmptyRows: true,
  columnRanks: {},
}

// A missing row, or a `hiddenColumns` that is not a choices map, falls back to the default hidden
// set — reading it as „hide nothing" would serve the whole allowlist, discount figures included.
export function sanitizeClientViewSettings(source: unknown): ClientViewSettingsT {
  if (typeof source !== 'object' || source === null) return DEFAULT_SETTINGS
  const { hiddenColumns, hideEmptyRows, columnRanks } = source as {
    hiddenColumns?: unknown
    hideEmptyRows?: unknown
    columnRanks?: unknown
  }
  return {
    hiddenColumns: resolveHiddenColumns(
      hiddenColumns,
      PREVIEW_VISIBLE_COLUMNS,
      CLIENT_DEFAULT_HIDDEN_COLUMNS,
    ),
    hideEmptyRows: hideEmptyRows !== false,
    columnRanks: sanitizeDocumentRanks(columnRanks, PREVIEW_VISIBLE_COLUMNS),
  }
}

export function toStoredClientViewSettings(
  settings: ClientViewSettingsT,
): Omit<ClientViewSettingsT, 'hiddenColumns'> & { hiddenColumns: HiddenColumnMapT } {
  return {
    ...sanitizeClientViewSettings(settings),
    // The in-memory list is the owner's answer for every column; sanitizing reads a list as no stored
    // choices and would put every column back on its code default.
    hiddenColumns: toHiddenColumnMap(settings.hiddenColumns, PREVIEW_VISIBLE_COLUMNS),
  }
}

export function clientDocumentColumns(ranks: ColumnRanksT): string[] {
  return orderDocumentKeys(CLIENT_DOCUMENT_COLUMNS, ranks)
}
