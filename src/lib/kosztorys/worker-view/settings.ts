import {
  DOCUMENT_PINNED_COLUMN,
  orderDocumentKeys,
  sanitizeDocumentRanks,
} from '@/lib/kosztorys/document-column-order'
import {
  WORKER_DOCUMENT_COLUMNS,
  WORKER_RATE_KEY,
  WORKER_VIEW_GROUPS,
} from '@/lib/kosztorys/worker-view/columns'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { ToolPlaneT } from '@/lib/kosztorys/types'
import type { ColumnRanksT } from '@/lib/table/column-order'

// Firm-wide, one set for every worker and investment (design #5). Same shape as the investor's
// ClientViewSettingsT, but a separate type: the two hold keys from different ceilings.
export type WorkerViewSettingsT = {
  hiddenColumns: string[]
  hideEmptyRows: boolean
  hidePlannedOnceExecuted: boolean
  columnRanks: ColumnRanksT
}

const WORKER_VIEW_KEYS: ReadonlySet<string> = new Set(
  WORKER_VIEW_GROUPS.flatMap((group) => group.keys),
)

export const WORKER_VIEW_DEFAULT_SETTINGS: WorkerViewSettingsT = {
  hiddenColumns: [],
  hideEmptyRows: true,
  hidePlannedOnceExecuted: true,
  columnRanks: {},
}

// Same fail-closed contract as `sanitizeClientViewSettings`: a key outside the worker ceiling is
// dropped on read and on write, so a hand-edited `price` in the global's JSON is inert rather than a
// way onto a worker's screen. Here the default hides nothing, so „closed" rests entirely on the
// ceiling — which is why `workerVisibleColumns` builds from the groups and only ever subtracts.
export function sanitizeWorkerViewSettings(source: unknown): WorkerViewSettingsT {
  if (typeof source !== 'object' || source === null) return WORKER_VIEW_DEFAULT_SETTINGS
  const { hiddenColumns, hideEmptyRows, hidePlannedOnceExecuted, columnRanks } = source as {
    hiddenColumns?: unknown
    hideEmptyRows?: unknown
    hidePlannedOnceExecuted?: unknown
    columnRanks?: unknown
  }
  return {
    hiddenColumns: Array.isArray(hiddenColumns)
      ? hiddenColumns.filter(
          (key): key is string =>
            typeof key === 'string' && WORKER_VIEW_KEYS.has(key) && key !== DOCUMENT_PINNED_COLUMN,
        )
      : WORKER_VIEW_DEFAULT_SETTINGS.hiddenColumns,
    hideEmptyRows: hideEmptyRows !== false,
    hidePlannedOnceExecuted: hidePlannedOnceExecuted !== false,
    columnRanks: sanitizeDocumentRanks(columnRanks, WORKER_VIEW_KEYS),
  }
}

/**
 * The closed column list of one worker's view, in FULL grid ids. The stawka resolves to this plane's
 * `price__<plane>` only: disclosure matches the full id (plane-price-keys.ts `basePriceKey`), so the
 * other plane's rate and the client `price` are simply never in the set.
 */
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

// Ordered over the LOGICAL keys, then mapped: the stawka's rank is stored under `rate`, so one
// firm-wide order serves both rozliczenia.
export function workerDocumentColumns(plane: ToolPlaneT, ranks: ColumnRanksT): string[] {
  return orderDocumentKeys(WORKER_DOCUMENT_COLUMNS, ranks).map((key) =>
    key === WORKER_RATE_KEY ? planePriceKey('price', plane) : key,
  )
}
