import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { LayerT } from '@/lib/kosztorys/layer'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { ProgressDisplayT } from '@/lib/kosztorys/progress-display'
import type { SortDirT } from '@/lib/kosztorys/row-view'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

export type V2SortStateT = { field: string; dir: SortDirT } | null

export type BuildV2ColumnsOptsT = {
  view: PriceViewT
  // Stages (etapy) render as dynamic editable columns; a trailing "Pozostało" reads out the
  // remaining net.
  stages: KosztorysStageT[]
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
  // Whether to prepend the row-actions column. The interactive cell handlers themselves
  // (insert/reorder/remove item, rename/remove section+stage) no longer thread through here — the
  // cells read them from useKosztorysEditorContext(), so passing ref-capturing closures into this
  // plain builder during render can't de-opt React Compiler (EX-496). This flag is the one bit the
  // builder still needs: the grid sets it, the column-set unit specs omit it (no actions column).
  rowActions?: boolean
  // Global discount active → the four per-item discount columns are overridden, so drop them from
  // the grid and the picker (the underlying data stays and returns when the discount is cleared).
  globalDiscountActive?: boolean
}
