import type { ColumnGroupT } from '@/lib/kosztorys/columns/column-config'
import { STAGES_COLUMN_GROUP, STAGE_VALUE_NET_COLUMN_GROUP } from '@/lib/kosztorys/stage-keys'

// Allowlist, not a denylist: a column added later is invisible to clients until someone puts it here,
// so the disclosure decision is forced at definition time rather than discovered as a leak.
//
// Its reach is column IDENTITY, not price plane: `price`/`net` are allowlisted and compute at
// whatever `view` is active, so this set does NOT by itself keep a subcontractor figure off the page.
// It is half a lock — the other half pins the plane, see `assertDisclosurePair`. `priceMode` is
// absent here and that absence is load-bearing, not belt-and-braces: the szablon workbench reads
// the client plane and assembles the column anyway (`assembleV2Columns`), so this list is the only
// thing keeping a contractor's price source off a client's document.
//
// No brutto column anywhere on the investor's document (owner, 2026-09-28): the offer is quoted netto,
// so a gross figure is not offered as a tick at all — and a stored tick for one fails closed here.
export const CLIENT_VIEW_GROUPS: readonly ColumnGroupT[] = [
  {
    label: 'Opis i ilości',
    keys: ['description', 'plannedQty', 'currentPlannedQty', 'stageQtySum', 'unit'],
  },
  {
    label: 'Ceny i rabat',
    keys: ['price', 'discountType', 'discountValue', 'discountAmount'],
  },
  {
    label: 'Wartości',
    // No `note`: the sheet's „komentarz" is owner-authored internal free text (owner ruling,
    // 2026-07-20) — the client DTO drops it too, so this is the matching half of that decision.
    keys: ['plannedNet', 'currentPlannedNet', 'net', 'remaining'],
  },
  {
    label: 'Etapy i postęp',
    keys: [STAGES_COLUMN_GROUP, STAGE_VALUE_NET_COLUMN_GROUP, 'donePercent'],
  },
]

export const PREVIEW_VISIBLE_COLUMNS: ReadonlySet<string> = new Set(
  CLIENT_VIEW_GROUPS.flatMap((group) => group.keys),
)
// The investor's document — podgląd, link and „Generuj ofertę" alike — in reading order, which is not
// the sheet's: the offered scope reads as one phrase (ilość, j.m., cena, wartość) ahead of the etapy,
// and the pomiar follows the etapy it sums (owner, 2026-09-28). One list for the screen and the paper,
// so the two cannot print different columns or the same ones in a different order. The same keys as
// CLIENT_VIEW_GROUPS, which orders them for the settings dialog instead.
export const CLIENT_DOCUMENT_COLUMNS: readonly string[] = [
  'description',
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
  'remaining',
]
