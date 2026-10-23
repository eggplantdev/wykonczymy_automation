import type { ColumnGroupT } from '@/lib/kosztorys/columns/column-config'
import {
  STAGES_COLUMN_GROUP,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
} from '@/lib/kosztorys/stage-keys'

// Netto money column → its brutto twin on the investor's document. `price` is netto here: the
// editor's `price` exemption from the money axis does not apply to a document.
export const CLIENT_GROSS_TWINS: Readonly<Record<string, string>> = {
  price: 'priceGross',
  plannedDiscountAmount: 'plannedDiscountAmountGross',
  discountAmount: 'discountAmountGross',
  plannedNet: 'plannedGross',
  currentPlannedNet: 'currentPlannedGross',
  net: 'gross',
  remaining: 'remainingGross',
  [STAGE_VALUE_NET_COLUMN_GROUP]: STAGE_VALUE_GROSS_COLUMN_GROUP,
}

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
    keys: ['price', 'discountType', 'discountValue', 'plannedDiscountAmount', 'discountAmount'],
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

export const PREVIEW_VISIBLE_COLUMNS: ReadonlySet<string> = new Set([
  ...CLIENT_VIEW_GROUPS.flatMap((group) => group.keys),
  ...Object.values(CLIENT_GROSS_TWINS),
])
export const CLIENT_DOCUMENT_COLUMNS: readonly string[] = [
  'description',
  'note',
  'plannedQty',
  'currentPlannedQty',
  'unit',
  'price',
  'priceGross',
  'plannedNet',
  'plannedGross',
  'currentPlannedNet',
  'currentPlannedGross',
  STAGES_COLUMN_GROUP,
  'stageQtySum',
  'discountValue',
  'discountType',
  'plannedDiscountAmount',
  'plannedDiscountAmountGross',
  'discountAmount',
  'discountAmountGross',
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  'net',
  'gross',
  'donePercent',
  'plannedDonePercent',
  'remaining',
  'remainingGross',
]
