import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { ColumnRanksT } from '@/lib/table/column-order'
import type { LayerT } from '@/lib/kosztorys/layer'
import type { CrewAxisT } from '@/lib/kosztorys/crew-axis'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { MoveEdgesT } from '@/lib/kosztorys/move-edges'
import type { SortPickT, SortStateT } from '@/lib/kosztorys/row-view'
import type {
  KosztorysStageT,
  KosztorysV2RowT,
  StageSplitT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'

export type BuildV2ColumnsOptsT = {
  view: PriceViewT
  stages: KosztorysStageT[]
  onRemoveStage?: (stageId: number) => void
  onRenameStage?: (stageId: number, label: string) => void
  onSetStagePlane?: (stageId: number, plane: ToolPlaneT) => void
  workers?: WorkerRefT[]
  onSetStageSplit?: (stageId: number, split: StageSplitT | null) => void
  executedValueByStage?: Map<number, number>
  scaledDownStageIds?: ReadonlySet<number>
  sort?: SortStateT
  onSetSort?: (field: string, pick: SortPickT | null) => void
  // Column picker: true = this column is off — by the user's stored choice OR by
  // DEFAULT_HIDDEN_COLUMNS, which the caller resolves; the two are indistinguishable here. Keyed by
  // column id, except stage columns, which answer to one of the stage groups (stage-keys.ts).
  isHidden?: (id: string) => boolean
  // Money axis: narrows the picker's answer further, never widens it. Omitted = 'both' = every
  // column the picker allows, which is what buildV2ToggleItems (axis-blind by design) assumes.
  moneyAxis?: MoneyAxisT
  // Layer: narrows to the working columns or the progress tracker. Omitted = 'both' = no narrowing.
  layer?: LayerT
  // Resize: pinned column widths (id→px) + drag callbacks. When provided, every column
  // gets a handle; pinned ones get basis/grow:0 (the rest stay on flex).
  widths?: Record<string, number>
  // User-defined column order: group key → rank (lib/table/column-order). Sparse — an absent key
  // ranks at its assemble position, so an empty map is the sheet's own order. Keyed like `isHidden`,
  // i.e. stage columns answer to their group, never to a per-stage id.
  columnRanks?: ColumnRanksT
  onGuide?: (x: number | null) => void
  onCommitColumn?: (id: string, width: number) => void
  onRemoveItem?: (row: KosztorysV2RowT) => void
  // Reordering items within a section (Przesuń w górę/dół). Greyed out while a column sort is
  // active — "up/down" has no meaning against a price-sorted list.
  onReorderItem?: (row: KosztorysV2RowT, dir: 'up' | 'down') => void
  // Over the WHOLE rozpiska: the mover works on the document, so a search hiding the row above
  // must not make ▲ look impossible.
  moveEdges?: MoveEdgesT
  onInsertItem?: (row: KosztorysV2RowT, dir: 'above' | 'below') => void
  // Renaming the whole section from its (denormalized) name cell. Routes through the same fan-out
  // as the section panel — never a per-row setRowData, which would desync the other rows' copies.
  onRenameSection?: (sectionId: number, name: string) => void
  // No column reads them (the caller takes them back out for the band), but they stay gated here so
  // one `editorOnly()` pass decides the whole write surface.
  onRemoveSection?: (sectionId: number) => void
  onReorderSection?: (sectionId: number, dir: 'up' | 'down') => void
  onInsertSection?: (sectionId: number, dir: 'above' | 'below') => void
  onSetSectionColor?: (sectionId: number, color: SectionColorKeyT | null) => void
  // „Zapisz kolejność": writes the active sort into display_order across every section, so the order
  // survives clearing the sort. Silent no-op without a sort — there is nothing to write then.
  onPersistKosztorysOrder?: () => void
  // Is the „z pomiarem do rozpisania na etapy" diagnostic pressed? Gates the „Rozjazd między arkuszem Google a apką"
  // column's existence: the column answers exactly that one question, and outside the gesture that
  // asks it the grid shows every pozycja — so it would be a near-empty stripe. The button's count is
  // what announces the rozjazd; the column is where you read it. It rides the filter rather than the
  // picker, hence UNPICKABLE_COLUMNS: no stored tick may contradict the button.
  divergenceFilterEngaged?: boolean
  // Engaged etap problems (stage-conditions.ts), narrowing which etapy get columns at all. Transient
  // like the flag above — it never reaches the persisted visibility map, which is what the ghost-id
  // ban in stage-keys.ts actually forbids. Empty/absent → every etap of the view keeps its columns.
  engagedStageConditionIds?: Iterable<string>
  // Columns the engaged problems are about (row-conditions.ts `columnsRevealedBy`). Overrides the
  // column picker's stored tick while the gesture lasts, and nothing else — never the money axis, the
  // layer or the preview allowlist. Transient like the two flags above; the tick itself is untouched,
  // so disengaging restores exactly what the user had chosen.
  revealedColumnIds?: ReadonlySet<string>
  // Is „Zapisz do katalogu…" offered on a praca? A flag rather than a callback because the dialog
  // owns its own state next to the menu — the grid must not re-render because a dialog opened. Off
  // in the read-only view, through the same `editorOnly` gate as every mutation callback here.
  canSaveItemToCatalogue?: boolean
  // Global discount active → the four per-item discount columns are overridden, so drop them from
  // the grid and the picker (the underlying data stays and returns when the discount is cleared).
  globalDiscountActive?: boolean
  // Lock the whole grid: every data cell becomes `disabled` and the row-actions column is dropped.
  // Omitting the mutation callbacks is NOT enough — a cell with no callback still takes focus and
  // enters edit mode, so a client-facing grid would look editable and swallow keystrokes.
  readOnly?: boolean
  // The client's document: exactly PREVIEW_VISIBLE_COLUMNS, and it OVERRIDES every option above that
  // describes one owner's reading preferences (isHidden / moneyAxis / layer), since
  // none of those may shape what a client is served. `globalDiscountActive` still applies — it is the
  // investment's own state, not a preference; selectV2Columns spells the split out.
  // Orthogonal to `readOnly`: read-only is about interaction, this is about disclosure. NOT orthogonal
  // to `view`, which must be 'client' whenever this is set — selectV2Columns throws on the mismatch,
  // and `assertDisclosurePair` says why.
  previewVisible?: boolean
  // What the document on screen — the investor's or the worker's — does not show: the owner's stored
  // choice (investor) plus the full ids the data takes off (settlement columns with no entries yet,
  // and for the worker the przedmiar pair once his etapy carry entries). It only ever subtracts from
  // the closed list — a key the list never allowed cannot reveal anything, which is what keeps the
  // list a ceiling rather than one of two competing answers.
  documentHiddenColumns?: ReadonlySet<string>
  // The owner's stored order for THIS investment's document (`ClientViewSettingsT.columnRanks`) —
  // never `columnRanks` above, which is one browser's preference and must not shape a client's
  // document (ruling 2026-07-28).
  previewColumnRanks?: ColumnRanksT
  // The szablon workbench: WORKSHOP_VISIBLE_COLUMNS over both the grid and the picker. Twin of
  // `previewVisible` in mechanism, its opposite in reason — that one is about what a client must
  // not see, this one about what a szablon cannot carry. The allowlist, not the stored tick: the
  // map of hidden columns is one per browser, so a tick would leak across every kosztorys.
  workshopVisible?: boolean
  // The worker's document (EX-875): the third closed surface, and the one that discloses a CREW
  // plane — `view` must equal `plane`, never 'client', and `previewVisible` must be off
  // (`assertDisclosurePair`). `hiddenColumns` holds the firm-wide settings' logical keys, which only
  // ever subtract from `workerVisibleColumns`. `executedQtyByItem` is Σ over EVERY etap of the
  // investment, because `stages` here are this worker's alone and „Pozostało" must not read another
  // crew's finished work as still owed.
  workerSurface?: {
    plane: ToolPlaneT
    hiddenColumns: readonly string[]
    columnRanks: ColumnRanksT
    executedQtyByItem: Record<number, number>
  }
  // Which crew's rate columns are on screen — see crew-axis.ts. Absent = CREW_AXIS_DEFAULT.
  crewAxis?: CrewAxisT
}
