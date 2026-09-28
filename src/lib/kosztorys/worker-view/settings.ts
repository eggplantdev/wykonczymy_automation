import { COLUMN_LABELS, WORKER_RATE_KEY, WORKER_VIEW_GROUPS } from '@/lib/kosztorys/column-config'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

// Firm-wide, one set for every worker and investment (design #5). Same shape as the investor's
// ClientViewSettingsT, but a separate type: the two hold keys from different ceilings.
export type WorkerViewSettingsT = {
  hiddenColumns: string[]
  hideEmptyRows: boolean
}

const WORKER_VIEW_KEYS: ReadonlySet<string> = new Set(
  WORKER_VIEW_GROUPS.flatMap((group) => group.keys),
)

export const WORKER_VIEW_DEFAULT_SETTINGS: WorkerViewSettingsT = {
  hiddenColumns: [],
  hideEmptyRows: true,
}

// Plane-agnostic names for the dialog: one tick answers for both rozliczenia, so it cannot quote the
// grid's per-plane header.
const WORKER_LABEL_OVERRIDES: Record<string, string> = {
  [WORKER_RATE_KEY]: 'Stawka j.m. netto',
  net: 'Wartość wykonana netto',
}

export function workerColumnLabel(key: string): string | undefined {
  return WORKER_LABEL_OVERRIDES[key] ?? COLUMN_LABELS[key]
}

// Same fail-closed contract as `sanitizeClientViewVariant`: a key outside the worker ceiling is
// dropped on read and on write, so a hand-edited `price` in the global's JSON is inert rather than a
// way onto a worker's screen. Here the default hides nothing, so „closed" rests entirely on the
// ceiling — which is why `workerVisibleColumns` builds from the groups and only ever subtracts.
export function sanitizeWorkerViewSettings(source: unknown): WorkerViewSettingsT {
  if (typeof source !== 'object' || source === null) return WORKER_VIEW_DEFAULT_SETTINGS
  const { hiddenColumns, hideEmptyRows } = source as {
    hiddenColumns?: unknown
    hideEmptyRows?: unknown
  }
  return {
    hiddenColumns: Array.isArray(hiddenColumns)
      ? hiddenColumns.filter(
          (key): key is string => typeof key === 'string' && WORKER_VIEW_KEYS.has(key),
        )
      : WORKER_VIEW_DEFAULT_SETTINGS.hiddenColumns,
    hideEmptyRows: hideEmptyRows !== false,
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
