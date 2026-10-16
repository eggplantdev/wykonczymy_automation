import type { ColumnGroupT } from '@/lib/kosztorys/columns/column-config'
import { STAGES_COLUMN_GROUP, STAGE_VALUE_NET_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'

// `priceMode` is
// absent here and that absence is load-bearing: the szablon workbench reads
// the client plane and assembles the column anyway (`assembleV2Columns`), so this list is the only
// thing keeping a contractor's price source off a client's document.
export const CLIENT_VIEW_GROUPS: readonly ColumnGroupT[] = [
  {
    label: 'Opis i ilości',
    keys: ['description', 'note', 'plannedQty', 'currentPlannedQty', 'stageQtySum', 'unit'],
  },
  {
    label: 'Ceny i rabat',
    keys: ['price', 'discountType', 'discountValue', 'discountAmount'],
  },
  {
    label: 'Wartości',
    keys: ['plannedNet', 'currentPlannedNet', 'net', 'remaining'],
  },
  {
    label: 'Etapy i postęp',
    keys: [STAGES_COLUMN_GROUP, STAGE_VALUE_NET_COLUMN_GROUP, 'donePercent', 'plannedDonePercent'],
  },
]

export const PREVIEW_VISIBLE_COLUMNS: ReadonlySet<string> = new Set(
  CLIENT_VIEW_GROUPS.flatMap((group) => group.keys),
)
export const CLIENT_DOCUMENT_COLUMNS: readonly string[] = [
  'description',
  'note',
  'plannedQty',
  'currentPlannedQty',
  'unit',
  'price',
  'plannedNet',
  'currentPlannedNet',
  STAGES_COLUMN_GROUP,
  'stageQtySum',
  'discountValue',
  'discountType',
  'discountAmount',
  STAGE_VALUE_NET_COLUMN_GROUP,
  'net',
  'donePercent',
  'plannedDonePercent',
  'remaining',
]
