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

// What one investment's client sees. Lives here rather than beside its query because the client
// components consume the type too, and that query is `server-only`.
export type ClientViewSettingsT = {
  hiddenColumns: string[]
  hideEmptyRows: boolean
  columnRanks: ColumnRanksT
}

// Expressed as what the client SEES, because that is what an owner reads off the dialog; the stored
// hidden set is its complement against the ceiling and is computed below, never written by hand.
// The settlement columns are in it from day one: they stay off the investor's screen until there is
// an entry to show (`settlement-columns.ts`), so an offer and a settlement need no separate sets.
// The Aktualizacja przedmiaru is ticked, its value is not — an available tick, like Pozostało.
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

const DEFAULT_HIDDEN_COLUMNS: ReadonlySet<string> = new Set(
  [...PREVIEW_VISIBLE_COLUMNS].filter((key) => !DEFAULT_VISIBLE_COLUMNS.has(key)),
)

const DEFAULT_SETTINGS: ClientViewSettingsT = {
  hiddenColumns: [...DEFAULT_HIDDEN_COLUMNS],
  hideEmptyRows: true,
  columnRanks: {},
}

// A key outside the ceiling is dropped, on write and on read alike: `PREVIEW_VISIBLE_COLUMNS` is the
// only thing deciding what MAY be shown, and stored choices must not become a second, drifting
// answer to that question when the allowlist later changes.
//
// Fails CLOSED on both axes. A column the stored choices do not mention reads as its code default,
// so a column added later starts unticked if the code says so (`resolveHiddenColumns`). And a missing
// row, or a `hiddenColumns` that is neither choices nor the legacy list, falls back to the default
// hidden set — reading it as „hide nothing" would serve the whole allowlist, discount figures
// included, off a column any owner can hand-edit in /admin.
//
// Called on `{}` this also IS the code default, so an unsaved investment and an unsaved firm-wide
// global reach the same answer with no second constant to drift from it.
export function sanitizeClientViewSettings(source: unknown): ClientViewSettingsT {
  if (typeof source !== 'object' || source === null) return DEFAULT_SETTINGS
  const { hiddenColumns, hideEmptyRows, columnRanks } = source as {
    hiddenColumns?: unknown
    hideEmptyRows?: unknown
    columnRanks?: unknown
  }
  return {
    hiddenColumns:
      resolveHiddenColumns(hiddenColumns, PREVIEW_VISIBLE_COLUMNS, DEFAULT_HIDDEN_COLUMNS) ??
      DEFAULT_SETTINGS.hiddenColumns,
    hideEmptyRows: hideEmptyRows !== false,
    columnRanks: sanitizeDocumentRanks(columnRanks, PREVIEW_VISIBLE_COLUMNS),
  }
}

export function toStoredClientViewSettings(
  settings: ClientViewSettingsT,
): Omit<ClientViewSettingsT, 'hiddenColumns'> & { hiddenColumns: HiddenColumnMapT } {
  const sanitized = sanitizeClientViewSettings(settings)
  return {
    ...sanitized,
    hiddenColumns: toHiddenColumnMap(sanitized.hiddenColumns, PREVIEW_VISIBLE_COLUMNS),
  }
}

export function clientDocumentColumns(ranks: ColumnRanksT): string[] {
  return orderDocumentKeys(CLIENT_DOCUMENT_COLUMNS, ranks)
}
