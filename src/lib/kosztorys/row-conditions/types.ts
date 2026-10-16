import type { FilterGroupIdT } from '@/lib/kosztorys/filter-groups'
import type { ProblemGroupIdT } from '@/lib/kosztorys/problem-groups'
import type { KosztorysStageT, KosztorysV2RowT, ToolPlaneT } from '@/lib/kosztorys/types'

export type RowConditionCtxT = {
  stages: KosztorysStageT[]
  // Whether the INVESTMENT has any material folded into robocizna (a „wliczony w robociznę" wydatek).
  hasSettledMaterial: boolean
  divergentPriceRowIds: ReadonlySet<number>
  qtyDoneByRowId?: ReadonlyMap<number, number>
  // „no katalog" must read as „no counter" rather than as „the cennik is empty", which would
  // report every single praca as missing from it.
  catalogueRowIds?: { divergent: ReadonlySet<number>; missing: ReadonlySet<number> }
  hasAiDraft?: boolean
  aiColumnsShown?: boolean
}

type RowConditionBaseT = {
  id: string
  // A bare noun phrase describing the row, so it reads after „Tylko: pozycje " (the active-filters
  // bar) and „Brak pozycji " (the empty state).
  label: string
  plane?: ToolPlaneT
  // While it is engaged the grid shows them even if the column picker has them unticked.
  revealsColumns?: readonly string[]
  matches: (row: KosztorysV2RowT, ctx: RowConditionCtxT) => boolean
}

// An option in the „Filtry" menu, unticked by default: a tick narrows the grid to what it matches.
// Ticks in one `filterGroup` widen each other; ticks in different groups narrow each other.
export type FilterConditionT = RowConditionBaseT & {
  kind: 'filter'
  filterGroup: FilterGroupIdT
  // The „Filtry" row, when the noun phrase is too long to scan there. Omitted = the menu capitalises `label`.
  menuLabel?: string
  // How it reads when it lifts to whole sekcje in the „Filtry" menu; null = it does not lift.
  sectionLabel: string | null
  // Its `matches` returns false under a global rabat, so `editorConditionIds` drops a tick persisted
  // from before the global rabat was switched on — kept, it would blank the kosztorys.
  inertUnderGlobalDiscount?: true
}

// A defect to close: it lives in the toolbar with a count, vanishes at zero, and when engaged keeps
// ONLY what it matches.
export type DiagnosticConditionT = RowConditionBaseT & {
  kind: 'diagnostic'
  problemGroup: ProblemGroupIdT
  // A whole sentence for the „Problemy" row, replacing the „Pozycje … (n)" phrasing built from
  // `label`.
  problemLabel?: (count: number) => string
}

export type ClientConditionT = RowConditionBaseT & { kind: 'client' }

export type RowConditionT = FilterConditionT | DiagnosticConditionT | ClientConditionT

export type RowConditionKindT = RowConditionT['kind']
