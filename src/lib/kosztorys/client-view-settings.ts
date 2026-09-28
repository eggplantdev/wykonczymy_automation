import {
  CLIENT_DOCUMENT_COLUMNS,
  DOCUMENT_PINNED_COLUMN,
  PREVIEW_VISIBLE_COLUMNS,
} from '@/lib/kosztorys/column-config'
import { orderDocumentKeys, sanitizeDocumentRanks } from '@/lib/kosztorys/document-column-order'
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
const DEFAULT_VISIBLE_COLUMNS: ReadonlySet<string> = new Set([
  'description',
  'plannedQty',
  'unit',
  'price',
  'plannedNet',
  'stageQtySum',
  'net',
  STAGES_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  'donePercent',
])

const DEFAULT_SETTINGS: ClientViewSettingsT = {
  hiddenColumns: [...PREVIEW_VISIBLE_COLUMNS].filter((key) => !DEFAULT_VISIBLE_COLUMNS.has(key)),
  hideEmptyRows: true,
  columnRanks: {},
}

// A key outside the ceiling is dropped, on write and on read alike: `PREVIEW_VISIBLE_COLUMNS` is the
// only thing deciding what MAY be shown, and a hidden-key list must not become a second, drifting
// answer to that question when the allowlist later changes.
//
// Fails CLOSED, because the stored value is the HIDDEN set: a missing row, and a `hiddenColumns`
// that is NULL or not an array, both fall back to the default hidden set. Reading them as „hide
// nothing" — which an empty array means — would serve the whole allowlist, discount figures
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
  const hideEmpty = hideEmptyRows !== false
  const ranks = sanitizeDocumentRanks(columnRanks, PREVIEW_VISIBLE_COLUMNS)
  if (!Array.isArray(hiddenColumns)) {
    return { ...DEFAULT_SETTINGS, hideEmptyRows: hideEmpty, columnRanks: ranks }
  }
  return {
    hiddenColumns: hiddenColumns.filter(
      (key): key is string =>
        typeof key === 'string' &&
        PREVIEW_VISIBLE_COLUMNS.has(key) &&
        key !== DOCUMENT_PINNED_COLUMN,
    ),
    hideEmptyRows: hideEmpty,
    columnRanks: ranks,
  }
}

// The investor's document in the owner's order — one list for the podgląd, the link and the PDF.
export function clientDocumentColumns(ranks: ColumnRanksT): string[] {
  return orderDocumentKeys(CLIENT_DOCUMENT_COLUMNS, ranks)
}
