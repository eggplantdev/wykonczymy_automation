import { COLUMN_LABELS, type ColumnGroupT } from '@/lib/kosztorys/columns/column-config'
import { emptySettlementColumnIds, stagesWithEntries } from '@/lib/kosztorys/settlement-columns'
import { STAGES_COLUMN_GROUP, STAGE_VALUE_NET_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// Stored settings hold this key, so one firm-wide tick answers for both rozliczenia — and no stored
// value can ever name `price`, the client's price.
export const WORKER_RATE_KEY = 'rate'

// A key missing here is a column no setting can put on a worker's screen.
export const WORKER_VIEW_GROUPS: readonly ColumnGroupT[] = [
  {
    label: 'Opis i ilości',
    keys: ['description', 'plannedQty', 'currentPlannedQty', 'stageQtySum', 'unit'],
  },
  {
    label: 'Stawka i wartości',
    keys: [WORKER_RATE_KEY, 'plannedNetForPlane', 'net', 'remainingForPlane'],
  },
  {
    label: 'Etapy i postęp',
    keys: [STAGES_COLUMN_GROUP, STAGE_VALUE_NET_COLUMN_GROUP, 'plannedDonePercent'],
  },
]

export const WORKER_DOCUMENT_COLUMNS: readonly string[] = [
  'description',
  'plannedQty',
  'currentPlannedQty',
  'unit',
  WORKER_RATE_KEY,
  'plannedNetForPlane',
  STAGES_COLUMN_GROUP,
  'stageQtySum',
  STAGE_VALUE_NET_COLUMN_GROUP,
  'net',
  'plannedDonePercent',
  'remainingForPlane',
]

const WORKER_LABEL_OVERRIDES: Record<string, string> = {
  [WORKER_RATE_KEY]: 'Stawka j.m. netto',
  net: 'Wartość wykonana netto',
}

export function workerColumnLabel(key: string): string | undefined {
  return WORKER_LABEL_OVERRIDES[key] ?? COLUMN_LABELS[key]
}

const PLANNED_COLUMNS = ['currentPlannedQty', 'plannedNetForPlane'] as const

export function workerDataHiddenColumns(
  rows: readonly KosztorysV2RowT[],
  stages: readonly KosztorysStageT[],
  hidePlannedOnceExecuted: boolean,
): ReadonlySet<string> {
  const hidden = new Set(emptySettlementColumnIds(rows, stages))
  if (hidePlannedOnceExecuted && stagesWithEntries(rows, stages).length > 0) {
    for (const id of PLANNED_COLUMNS) hidden.add(id)
  }
  return hidden
}
