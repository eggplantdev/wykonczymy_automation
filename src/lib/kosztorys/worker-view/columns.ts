import { COLUMN_LABELS, type ColumnGroupT } from '@/lib/kosztorys/column-config'
import { STAGES_COLUMN_GROUP, STAGE_VALUE_NET_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'

// The worker view's stawka, as a LOGICAL key: the column it stands for is `price__<plane>`, and which
// plane is decided per worker, at render (`workerVisibleColumns`). Stored settings hold this key, so
// one firm-wide tick answers for both rozliczenia — and no stored value can ever name `price`, the
// client's price.
export const WORKER_RATE_KEY = 'rate'

// The worker view's ceiling (design #13, EX-875), as ticks for the settings dialog. A separate list
// from CLIENT_VIEW_GROUPS, not a subset of it, because the two surfaces disclose opposite prices: a
// key missing here is a column no setting can put on a worker's screen. The client price, rabat,
// brutto, the client-priced „Wartość przedmiaru" / „Pozostało" / „% wykonania" and „Komentarz" are
// absent by construction — the first two alone would give the margin away.
export const WORKER_VIEW_GROUPS: readonly ColumnGroupT[] = [
  {
    label: 'Opis i ilości',
    keys: ['description', 'plannedQty', 'stageQtySum', 'unit'],
  },
  {
    label: 'Stawka i wartości',
    keys: [WORKER_RATE_KEY, 'plannedNetForPlane', 'net', 'remainingForPlane'],
  },
  {
    label: 'Etapy',
    keys: [STAGES_COLUMN_GROUP, STAGE_VALUE_NET_COLUMN_GROUP],
  },
]

// The worker's document — their link, the owner's Podgląd and their PDF — in reading order. Same reasons
// and same contract as CLIENT_DOCUMENT_COLUMNS, over the keys of WORKER_VIEW_GROUPS.
export const WORKER_DOCUMENT_COLUMNS: readonly string[] = [
  'description',
  'plannedQty',
  'unit',
  WORKER_RATE_KEY,
  'plannedNetForPlane',
  STAGES_COLUMN_GROUP,
  'stageQtySum',
  STAGE_VALUE_NET_COLUMN_GROUP,
  'net',
  'remainingForPlane',
]

// Plane-agnostic names for the dialog: one tick answers for both rozliczenia, so it cannot quote the
// grid's per-plane header.
const WORKER_LABEL_OVERRIDES: Record<string, string> = {
  [WORKER_RATE_KEY]: 'Stawka j.m. netto',
  net: 'Wartość wykonana netto',
}

export function workerColumnLabel(key: string): string | undefined {
  return WORKER_LABEL_OVERRIDES[key] ?? COLUMN_LABELS[key]
}
