import {
  orderDocumentKeys,
  sanitizeDocumentRanks,
} from '@/lib/kosztorys/columns/document-column-order'
import {
  resolveHiddenColumns,
  toHiddenColumnMap,
  type HiddenColumnMapT,
} from '@/lib/kosztorys/columns/document-column-visibility'
import {
  WORKER_DOCUMENT_COLUMNS,
  WORKER_RATE_KEY,
  WORKER_VIEW_GROUPS,
} from '@/lib/kosztorys/worker-view/columns'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { ToolPlaneT } from '@/lib/kosztorys/types'
import type { ColumnRanksT } from '@/lib/table/column-order'

export type WorkerViewSettingsT = {
  hiddenColumns: string[]
  hideEmptyRows: boolean
  hidePlannedOnceExecuted: boolean
  columnRanks: ColumnRanksT
}

const WORKER_VIEW_KEYS: ReadonlySet<string> = new Set(
  WORKER_VIEW_GROUPS.flatMap((group) => group.keys),
)

const WORKER_DEFAULT_HIDDEN_COLUMNS: ReadonlySet<string> = new Set([
  'plannedQty',
  'plannedDonePercent',
])

// The ceiling as it stood while the hidden ARRAY was the stored shape — frozen, never extended.
const LEGACY_WORKER_COLUMNS: ReadonlySet<string> = new Set([
  'plannedQty',
  'currentPlannedQty',
  'stageQtySum',
  'unit',
  'rate',
  'plannedNetForPlane',
  'net',
  'remainingForPlane',
  'stages',
  'stageValueNet',
  'plannedDonePercent',
])

export const WORKER_VIEW_DEFAULT_SETTINGS: WorkerViewSettingsT = {
  hiddenColumns: [...WORKER_DEFAULT_HIDDEN_COLUMNS],
  hideEmptyRows: true,
  hidePlannedOnceExecuted: true,
  columnRanks: {},
}

// A key outside the worker ceiling is dropped on read and on write, so a hand-edited `price` in the
// global's JSON is inert rather than a way onto a worker's screen.
export function sanitizeWorkerViewSettings(source: unknown): WorkerViewSettingsT {
  if (typeof source !== 'object' || source === null) return WORKER_VIEW_DEFAULT_SETTINGS
  const { hiddenColumns, hideEmptyRows, hidePlannedOnceExecuted, columnRanks } = source as {
    hiddenColumns?: unknown
    hideEmptyRows?: unknown
    hidePlannedOnceExecuted?: unknown
    columnRanks?: unknown
  }
  return {
    hiddenColumns: resolveHiddenColumns(
      hiddenColumns,
      WORKER_VIEW_KEYS,
      WORKER_DEFAULT_HIDDEN_COLUMNS,
      LEGACY_WORKER_COLUMNS,
    ),
    hideEmptyRows: hideEmptyRows !== false,
    hidePlannedOnceExecuted: hidePlannedOnceExecuted !== false,
    columnRanks: sanitizeDocumentRanks(columnRanks, WORKER_VIEW_KEYS),
  }
}

export function toStoredWorkerViewSettings(
  settings: WorkerViewSettingsT,
): Omit<WorkerViewSettingsT, 'hiddenColumns'> & { hiddenColumns: HiddenColumnMapT } {
  const sanitized = sanitizeWorkerViewSettings(settings)
  // The in-memory list is the owner's answer for every column; `sanitized` would read it as the
  // legacy stored array and put a column added since back on its code default.
  const hidden = Array.isArray(settings.hiddenColumns)
    ? settings.hiddenColumns
    : sanitized.hiddenColumns
  return {
    ...sanitized,
    hiddenColumns: toHiddenColumnMap(hidden, WORKER_VIEW_KEYS),
  }
}

export function workerVisibleColumns(
  plane: ToolPlaneT,
  hidden: readonly string[],
): ReadonlySet<string> {
  const hiddenSet = new Set(hidden)
  const columns = new Set<string>()
  for (const key of WORKER_VIEW_KEYS) {
    if (hiddenSet.has(key)) continue
    columns.add(key === WORKER_RATE_KEY ? planePriceKey('price', plane) : key)
  }
  return columns
}

export function workerDocumentColumns(plane: ToolPlaneT, ranks: ColumnRanksT): string[] {
  return orderDocumentKeys(WORKER_DOCUMENT_COLUMNS, ranks).map((key) =>
    key === WORKER_RATE_KEY ? planePriceKey('price', plane) : key,
  )
}
