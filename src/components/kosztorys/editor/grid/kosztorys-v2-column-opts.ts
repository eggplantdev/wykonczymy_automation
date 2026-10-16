import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { ColumnRanksT } from '@/lib/table/column-order'
import type { LayerT } from '@/lib/kosztorys/layer'
import type { CrewAxisT } from '@/lib/kosztorys/crew-axis'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { SortPickT, SortStateT } from '@/lib/kosztorys/row-view'
import type {
  KosztorysStageT,
  KosztorysV2RowT,
  StageSplitT,
  ToolPlaneT,
} from '@/lib/kosztorys/types'
import type { RowCatalogueEntryT } from '@/lib/kosztorys/work-catalogue/types'
import type { WorkerRefT } from '@/types/reference-data'
import type { TranslatorT } from '@/lib/i18n/translations'

export type StageOpsT = {
  rename: (stageId: number, label: string) => void
  remove: (stageId: number) => void
  setPlane: (stageId: number, plane: ToolPlaneT) => void
  setCompleted: (stageId: number, completed: boolean) => void
  setSplit: (stageId: number, split: StageSplitT | null) => void
}

export type BuildV2ColumnsOptsT = {
  view: PriceViewT
  stages: KosztorysStageT[]
  stageOps?: StageOpsT
  workers?: WorkerRefT[]
  executedValueByStage?: Map<number, number>
  scaledDownStageIds?: ReadonlySet<number>
  sort?: SortStateT
  onSetSort?: (field: string, pick: SortPickT | null) => void
  isHidden?: (id: string) => boolean
  isStageHidden?: (stageId: number) => boolean
  moneyAxis?: MoneyAxisT
  layer?: LayerT
  widths?: Record<string, number>
  columnRanks?: ColumnRanksT
  onGuide?: (x: number | null) => void
  onCommitColumn?: (id: string, width: number) => void
  columnColors?: Record<string, SectionColorKeyT>
  onSetColumnColor?: (id: string, color: SectionColorKeyT | null) => void
  onRemoveItem?: (row: KosztorysV2RowT) => void
  onInsertItem?: (row: KosztorysV2RowT, dir: 'above' | 'below') => void
  // Routes through the same fan-out as the section panel — never a per-row setRowData, which would
  // desync the other rows' copies.
  onRenameSection?: (sectionId: number, name: string) => void
  onRemoveSection?: (sectionId: number) => void
  onInsertSection?: (sectionId: number, dir: 'above' | 'below') => void
  onSetSectionColor?: (sectionId: number, color: SectionColorKeyT | null) => void
  onPersistKosztorysOrder?: () => void
  divergenceFilterEngaged?: boolean
  engagedStageConditionIds?: Iterable<string>
  revealedColumnIds?: ReadonlySet<string>
  canSaveItemToCatalogue?: boolean
  globalDiscountActive?: boolean
  // Omitting the mutation callbacks is NOT enough — a cell with no callback still takes focus and
  // enters edit mode, so a client-facing grid would look editable and swallow keystrokes.
  readOnly?: boolean
  // The client's document: exactly PREVIEW_VISIBLE_COLUMNS, and it OVERRIDES every option above that
  // describes one owner's reading preferences (isHidden / moneyAxis / layer), since none of those may
  // shape what a client is served.
  previewVisible?: boolean
  documentHiddenColumns?: ReadonlySet<string>
  // The owner's stored order for THIS investment's document — never `columnRanks` above, which is
  // one browser's preference and must not shape a client's document.
  previewColumnRanks?: ColumnRanksT
  workshopVisible?: boolean
  catalogueEntryByRowId?: ReadonlyMap<number, RowCatalogueEntryT>
  hasAiDraft?: boolean
  offerVisible?: boolean
  aiColumnsShown?: boolean
  // `executedQtyByItem` is Σ over EVERY etap of the investment, because `stages` here are this
  // worker's alone and „Pozostało" must not read another crew's finished work as still owed.
  workerSurface?: {
    plane: ToolPlaneT
    hiddenColumns: readonly string[]
    columnRanks: ColumnRanksT
    executedQtyByItem: Record<number, number>
  }
  crewAxis?: CrewAxisT
  dictionary?: TranslatorT<'grid'>
}
