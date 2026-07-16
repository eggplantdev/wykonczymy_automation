import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { LayerT } from '@/lib/kosztorys/layer'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { ProgressDisplayT } from '@/lib/kosztorys/progress-display'
import type { SortDirT } from '@/lib/kosztorys/row-view'
import type { KosztorysStageT, KosztorysV2RowT } from '@/types/kosztorys'

export type V2SortStateT = { field: string; dir: SortDirT } | null

export type BuildV2ColumnsOptsT = {
  view: PriceViewT
  // Stages (etapy) render as dynamic editable columns; a trailing "Pozostało" reads out the
  // remaining net.
  stages: KosztorysStageT[]
  onRemoveStage?: (stageId: number) => void
  onRenameStage?: (stageId: number, label: string) => void
  sort?: V2SortStateT
  onSetSort?: (field: string, dir: SortDirT | null) => void
  // Column picker: true = this column is off — by the user's stored choice OR by
  // DEFAULT_HIDDEN_COLUMNS, which the caller resolves; the two are indistinguishable here. Keyed by
  // column id, except stage columns, which answer to one of the three stage groups (constants.ts).
  isHidden?: (id: string) => boolean
  // Money axis: narrows the picker's answer further, never widens it. Omitted = 'both' = every
  // column the picker allows, which is what buildV2ToggleItems (axis-blind by design) assumes.
  moneyAxis?: MoneyAxisT
  // Progress display: narrows the same way the money axis does, on the other axis — a stage's
  // progress reads either as money or as a percentage, never as both at once.
  progressDisplay?: ProgressDisplayT
  // Layer: narrows to the working columns or the progress tracker. Omitted = 'both' = no narrowing.
  layer?: LayerT
  // Resize: pinned column widths (id→px) + drag callbacks. When provided, every column
  // gets a handle; pinned ones get basis/grow:0 (the rest stay on flex).
  widths?: Record<string, number>
  onGuide?: (x: number | null) => void
  onCommitColumn?: (id: string, width: number) => void
  // Row actions: removing an item + reading a section's item count (to enforce the
  // "≥1 item" invariant).
  onRemoveItem?: (row: KosztorysV2RowT) => void
  // Reason the row's delete is blocked (disabled + tooltip), or undefined if removable.
  getRemoveBlockReason?: (row: KosztorysV2RowT) => string | undefined
  // Reordering items within a section (Przesuń w górę/dół). Greyed out while a column sort is
  // active — "up/down" has no meaning against a price-sorted list.
  onReorderItem?: (row: KosztorysV2RowT, dir: 'up' | 'down') => void
  // Inserting a blank item above/below the row within its section.
  onInsertItem?: (row: KosztorysV2RowT, dir: 'above' | 'below') => void
  // Renaming the whole section from its (denormalized) name cell. Routes through the same fan-out
  // as the section panel — never a per-row setRowData, which would desync the other rows' copies.
  onRenameSection?: (sectionId: number, name: string) => void
  // Global discount active → the four per-item discount columns are overridden, so drop them from
  // the grid and the picker (the underlying data stays and returns when the discount is cleared).
  globalDiscountActive?: boolean
}
