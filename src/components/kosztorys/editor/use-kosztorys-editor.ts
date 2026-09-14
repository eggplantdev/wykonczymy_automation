'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDebouncedSave } from '@/components/kosztorys/editor/hooks/use-debounced-save'
import { useStaleTreeRecovery } from '@/components/kosztorys/editor/hooks/use-stale-tree-recovery'
import {
  coalesceFieldChanges,
  coalesceStageChanges,
  foldRetractions,
  undoAvailability,
  type FieldChangeT,
  type GridBurstT,
  type StageChangeT,
} from '@/lib/kosztorys/undo-coalesce'
import { planGridChanges } from '@/lib/kosztorys/grid-change-plan'
import { itemFieldLane, stageLane } from '@/lib/kosztorys/save-lanes'
import { buildReversalPatches, planReversalWrites } from '@/lib/kosztorys/undo-reversal'
import type { UndoCommandT, UndoRedoApiT } from '@/components/kosztorys/editor/hooks/use-undo-redo'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { useColumnWidths } from '@/components/kosztorys/editor/hooks/use-column-widths'
import { useRowHeights } from '@/components/kosztorys/editor/hooks/use-row-heights'
import { useConditionRowLatch } from '@/components/kosztorys/editor/hooks/use-condition-row-latch'
import { engagedProblemIds, engagedStageProblemIds } from '@/lib/kosztorys/problem-conditions'
import { useKosztorysSettings } from '@/components/kosztorys/editor/hooks/use-kosztorys-settings'
import { useKosztorysStageOps } from '@/components/kosztorys/editor/hooks/use-kosztorys-stage-ops'
import { useKosztorysViewState } from '@/components/kosztorys/editor/hooks/use-kosztorys-view-state'
import { useColumnOrder } from '@/components/kosztorys/editor/hooks/use-column-order'
import { useHiddenColumns } from '@/components/kosztorys/editor/hooks/use-hidden-columns'
import { useLayer } from '@/components/kosztorys/editor/hooks/use-layer'
import { useMoneyAxis } from '@/components/kosztorys/editor/hooks/use-money-axis'
import { effectiveMoneyAxis } from '@/lib/kosztorys/money-axis'
import { useElementHeight } from '@/hooks/use-element-height'
import { buildV2Grid } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import {
  applyAddItem,
  applyInsertItem,
  applyInsertSectionRow,
  applyRemoveItem,
  applyRestoreItem,
  applyKosztorysOrder,
  buildBlankRow,
  groupBySection,
  neighborSectionId,
  revertField,
  sectionNeighbor,
  swapItemInSection,
  swapSectionBlock,
  type BlankRowInputT,
} from '@/lib/kosztorys/row-ops'
import { isLastItemInSection, sectionItemCounts } from '@/lib/kosztorys/delete-policy'
import { columnTotalsForRows } from '@/lib/kosztorys/column-totals'
import { sectionSubtotalsForView, stageAxisForView } from '@/lib/kosztorys/settlement-aggregates'
import { clientTotalsFromSubtotals } from '@/lib/kosztorys/settlement-client-totals'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import { marginForecastByPlane as forecastByPlane } from '@/lib/kosztorys/margin-forecast'
import { divergentPriceRowIds } from '@/lib/kosztorys/price-divergence'
import { qtyDoneByRow } from '@/lib/kosztorys/row-conditions/ctx'
import { buildViewRows } from '@/lib/kosztorys/row-view'
import {
  applyRowConditions,
  columnsRevealedBy,
  countMatching,
  liftsToSections,
  sectionIdsWhereAllMatch,
} from '@/lib/kosztorys/row-conditions/queries'
import {
  MEASURE_DIVERGED_CONDITION_ID,
  ROW_CONDITIONS,
} from '@/lib/kosztorys/row-conditions/registry'
import { STAGE_CONDITIONS, countMatchingStages } from '@/lib/kosztorys/stage-conditions'
import { stagesForView } from '@/lib/kosztorys/settlement-view'
import { baseOrdinals, sectionRepresentatives } from '@/lib/kosztorys/section-band-rows'
import { columnSortValue, reconcileSort } from '@/lib/kosztorys/sort-value'
import { planKosztorysRenumber } from '@/lib/kosztorys/display-order-plan'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { sectionFooterRowId, sectionHeaderRowId } from '@/lib/kosztorys/synthetic-rows'
import { roundToCents } from '@/lib/utils/round-to-cents'
import {
  addItemAction,
  addSectionAction,
  insertItemAction,
  insertSectionAction,
  removeItemAction,
  removeSectionAction,
  renumberKosztorysOrderAction,
  setStageProgressAction,
  swapItemOrderAction,
  swapSectionOrderAction,
  updateItemFieldAction,
  updateSectionFieldAction,
} from '@/lib/actions/kosztorys'
import type { ItemPatchT, KosztorysTreeT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'

type ArgsT = {
  investmentId: number
  tree: KosztorysTreeT
  // The read-only client-facing render — BOTH the public share link and the owner's „Podgląd dla
  // inwestora", which are deliberately the same render. Distinct from `view === 'client'`, which is a
  // PRICE PLANE (client prices vs a subcontractor's); the render mode is what pins that plane, so the
  // two must not share the word (owner ruling 2026-07-28).
  preview?: boolean
  // The investment's stored client-view settings, resolved server-side. Only consumed under
  // `preview` — on the owner's editor it is absent, and the settings dialog reads its own copy.
  clientView?: ClientViewSettingsT
  // „Zakończona" — the server refuses every kosztorys write, so nothing here may offer one. Kept
  // apart from `preview` on purpose: the two agree on interaction and disagree on disclosure, and a
  // locked investment is still the owner's OWN full document.
  locked?: boolean
  undoRedo: UndoRedoApiT
  // Roster for the etap header's worker picker. Absent on the client share path, which never renders
  // a menu at all.
  workers?: WorkerRefT[]
  // Whether the investment has any wydatek folded into robocizna — the gate on the overpaid-crew
  // problem (EX-708). Optional with a `false` default for the client-share entry points, which count
  // no problems at all; on the owner's editor it is always supplied.
  hasSettledMaterial?: boolean
  // The shell's reseed-the-whole-tree path, taken when a write comes back NOT_FOUND — see
  // useStaleTreeRecovery. Absent on the read-only body, which never writes.
  onStaleTree?: () => Promise<void>
}

// Grace period after the last keystroke before a grid edit burst becomes one undo entry. Longer
// than the debounced save (500ms) so a command is captured only once the writes for the burst have
// been scheduled — never mid-typing.
const UNDO_COALESCE_MS = 700
// Separate knob from UNDO_COALESCE_MS despite the matching value — one decides when a burst becomes
// one undo entry, the other when the server's recomputed totals are worth a round trip.
const TOTALS_REFRESH_DEBOUNCE_MS = 700

// All editor state, derived data, and handlers for the in-app kosztorys grid. Kept out of the
// component so the component is only composition + markup. Handlers never fire an action from
// inside a setRows updater — that would move the Router during render.
export function useKosztorysEditor({
  investmentId,
  tree,
  preview = false,
  clientView,
  locked = false,
  undoRedo,
  workers,
  hasSettledMaterial = false,
  onStaleTree,
}: ArgsT) {
  // Interaction, split from disclosure. `preview` decides what a client is SHOWN (layout, allowlisted
  // columns, dimmed forecasts); this decides whether anything may be written at all, and the two
  // reasons for „no writing" are a client's document and a closed investment.
  const readOnly = preview || locked
  const router = useRouter()
  const { recoverStaleTree, reportFailure } = useStaleTreeRecovery(onStaleTree)
  const { save, runNow } = useDebouncedSave(500, recoverStaleTree)
  // Per-mount undo/redo stack, owned by the shell (KosztorysEditorV2) and passed in. Capture pushes
  // here; the toolbar + keyboard call undo/redo (re-exported below).
  const { push, undo, redo, canUndo, canRedo, pruneByIds, amendTop } = undoRedo
  const [gridRef, gridHeight, gridNode] = useElementHeight()
  // The row store (this + prevById + rowsRef + patchRows + revertOne) reads like the obvious fourth
  // extraction after settlement settings / stage ops / view state, and isn't one (EX-702): those three
  // each had a narrow seam, while the store has ~47 references across ~30 handlers below. Pulling it
  // into a useKosztorysRows would relocate five declarations and leave every one of those call sites
  // reaching in — an indirection layer on the hottest path EX-496 was reverted over. Settle EX-422
  // first: if rowsRef/prevById are no longer load-bearing, the thing left to extract is a smaller one.
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() => treeToRows(tree))
  const {
    view,
    setView,
    search,
    setSearch,
    engagedConditionIds,
    toggleCondition,
    toggleConditionExclusive,
    sort,
    setSort,
    setSortField,
    collapsedSectionIds,
    storedCollapsedSectionIds,
    setCollapsedSectionIds,
    toggleSectionCollapsed,
    unfoldSection,
    resetFilters,
    guideX,
    setGuideX,
    guideY,
    setGuideY,
  } = useKosztorysViewState({ investmentId, preview, clientView })

  // Column widths: persisted in localStorage, committed on handle release (not per pointermove —
  // that would be a write per pixel).
  const { widths, setWidth, dropWidth } = useColumnWidths()
  const { heights: rowHeights, setHeight: setRowHeight, dropHeight } = useRowHeights()
  const { isHidden, toggleColumn, setAllColumns } = useHiddenColumns()
  const {
    ranks: columnRanks,
    setRank: setColumnRank,
    resetOrder: resetColumnOrder,
  } = useColumnOrder()
  const [moneyAxis, setMoneyAxis] = useMoneyAxis()
  // Nothing here is pinned for a preview: selectV2Columns drops every gate but the allowlist under
  // `previewVisible`, so the axis — like the layer and the picker below — never reaches the client's
  // grid in the first place.
  const axis = effectiveMoneyAxis(view, moneyAxis)
  const [layer, setLayer] = useLayer()
  // Snapshot of the previous rows for diffing (keyed by item id) — the full dataset, not the view.
  // It also serves as the "fresh dataset" read by structural event handlers (section count):
  // kept in sync on every add/remove/edit, so no separate ref for rows is needed.
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))
  // "Latest value" ref: the fresh `rows` (display order) read during an event-time reorder, since
  // firing an action inside the setRows updater would update the Router during render (a React
  // error). Writing a ref during render is the well-known, safe "latest value" pattern.
  // NOTE (EX-422): these two refs were introduced to dodge a mount-frozen column closure, which no
  // longer exists — the grid is on the reactive `DynamicDataSheetGrid` export as of `ee497cb`, so
  // its closures are rebuilt each render. Kept deliberately as the rollback path; whether they are
  // still load-bearing is EX-422's own follow-up, not a freebie to delete alongside it.
  const rowsRef = useRef(rows)

  // react-hooks/refs forbids a render-time ref write outright; this is the deliberate latest-value
  // pattern described above.
  // eslint-disable-next-line react-hooks/refs
  rowsRef.current = rows

  const {
    stages,
    handleAddStage,
    handleRemoveStage,
    handleRenameStage,
    handleSetStagePlane,
    handleSetStageWorker,
  } = useKosztorysStageOps({
    investmentId,
    initialStages: tree.stages,
    patchRows,
    dropWidth,
    save,
    reportFailure,
  })

  // Grid edit burst awaiting a coalesced undo entry (see UNDO_COALESCE_MS). onChange appends each
  // keystroke's changes here; the flush timer collapses them into a single command once typing stops.
  const pendingFields = useRef<FieldChangeT[]>([])
  const pendingStages = useRef<StageChangeT[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Reactive mirror of "a burst is buffering" (the refs above aren't reactive). Drives canUndo during
  // the ≤700ms coalesce window so the toolbar button and keyboard Cmd+Z agree: a first-edit keystroke
  // enables Undo immediately (Cmd+Z flushes-then-undoes), instead of the button staying greyed until
  // flush while the shortcut already works (EX-526 #5).
  const [hasPendingBurst, setHasPendingBurst] = useState(false)

  // The grid command sitting on top of the stack, kept with the burst it captured so the next flush
  // can tell whether it retracts it (EX-737). Never consulted without the identity guard in
  // `amendTop`, which is what makes a stale entry here harmless rather than a source of truth.
  const lastGridCommand = useRef<{ command: UndoCommandT; burst: GridBurstT } | null>(null)

  function gridCommand({ fields, stages }: GridBurstT): UndoCommandT | null {
    if (fields.length === 0 && stages.length === 0) return null
    return {
      label: 'Edycja',
      undo: () => runGridReversal(fields, stages, 'undo'),
      redo: () => runGridReversal(fields, stages, 'redo'),
      touchedIds: [...new Set([...fields.map((c) => c.id), ...stages.map((c) => c.id)])],
    }
  }

  // Collapse the buffered burst into one undo command (before=first seen, after=last), dropping a
  // net-zero burst (type-then-revert) entirely so it never lands a dead entry on the stack. A burst
  // that takes back the command already on top cancels against it too, so a refused value and the
  // prefix it left behind leave the stack exactly as they found it.
  function flushUndoBuffer() {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    let burst: GridBurstT = {
      fields: coalesceFieldChanges(pendingFields.current),
      stages: coalesceStageChanges(pendingStages.current),
    }
    pendingFields.current = []
    pendingStages.current = []
    setHasPendingBurst(false)

    const previous = lastGridCommand.current
    if (previous) {
      const folded = foldRetractions(previous.burst, burst)
      if (folded.retracted) {
        const trimmed = gridCommand(folded.previous)
        if (amendTop(previous.command, trimmed)) {
          lastGridCommand.current = trimmed ? { command: trimmed, burst: folded.previous } : null
          burst = folded.next
        }
      }
    }

    const command = gridCommand(burst)
    if (!command) return
    push(command)
    lastGridCommand.current = { command, burst }
  }

  // A failed save can filter the last entry out of the burst buffers; if that empties them, cancel the
  // pending flush and clear the reactive flag so canUndo stops reporting a burst that no longer exists
  // (otherwise the Undo button stays enabled for the rest of the window but has nothing to flush).
  function clearBurstIfEmpty() {
    if (pendingFields.current.length > 0 || pendingStages.current.length > 0) return
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    setHasPendingBurst(false)
  }

  // A failed save's revert calls one of these to pull its now-reverted change out of the buffered
  // burst (EX-526 #4), then re-checks whether that emptied the buffer.
  function dropPendingField(id: number, field: keyof ItemPatchT) {
    pendingFields.current = pendingFields.current.filter((c) => !(c.id === id && c.field === field))
    clearBurstIfEmpty()
  }

  function dropPendingStage(id: number, stageId: number) {
    pendingStages.current = pendingStages.current.filter(
      (c) => !(c.id === id && c.stageId === stageId),
    )
    clearBurstIfEmpty()
  }

  // A restore remounts the body; drop any dangling timer so a pending flush can't push a command
  // closing over the outgoing mount's setRows/prevById, and a pending refresh can't re-render a route
  // the user has already left.
  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [])

  // Push a structural command (reorder / rename / coeff / VAT) — flushing any still-buffering grid
  // edit first, so a burst typed just before the structural action keeps its correct chronological
  // (LIFO) place on the stack instead of being pushed after it.
  function pushCommand(cmd: Parameters<typeof push>[0]) {
    flushUndoBuffer()
    push(cmd)
  }

  // A structural command whose reversal is just re-running one `apply` with the before/after state —
  // direction is expressed by which argument is replayed, so undo and redo share the same function.
  function pushReversible<T>(label: string, apply: (state: T) => void, before: T, after: T) {
    pushCommand({ label, undo: () => apply(before), redo: () => apply(after) })
  }

  // Called above the column build: `columnOpts` reads globalDiscountActive and the settings handlers.
  // `patchRows` and `pushReversible` are function declarations, so passing them here is safe despite
  // patchRows being written further down.
  const {
    globalDiscount,
    globalDiscountActive,
    isSavingSettings,
    investorImpactConfirm,
    handleGlobalCoeffChange,
    handleVatChange,
    handleSettlementModeChange,
    handleMaterialsNetRateChange,
    handleGlobalDiscountChange,
    handleApplyPercentDiscount,
  } = useKosztorysSettings({ investmentId, tree, rowsRef, patchRows, pushReversible })

  // One O(n) pass; every row's actions menu reads its own section's count for the delete confirm.
  const sectionCounts = sectionItemCounts(rows)

  // onRemoveItem/onReorderItem read prevById.current / rowsRef.current — stable refs —
  // only from a cell's onClick, never during render, so passing them here is safe.
  // In preview the grid is read-only (buildV2Grid disables every cell + drops the action column)
  // and column-filtered to the client-visible set, so every DATA-MUTATION callback is dropped — there
  // is no control left that could fire them. Column resize (onGuide/onCommitColumn) is the exception:
  // it only moves a localStorage width, never touches the server, so a client keeps it for readability.
  // Sort is dropped (headers render as plain labels) — the client sees a fixed, non-interactive order.
  // The gate is the render mode plus the investment's state, NOT a role: OWNER/MANAGER/ADMIN all
  // edit an open kosztorys, and none of them edits a closed one.
  const editorOnly = <T>(handler: T): T | undefined => (readOnly ? undefined : handler)

  // „Suma wykonanej pracy" (należne) for the subcontractor summary — view-INDEPENDENT: each etap
  // valued at its own plane's price, split + combined. Reactive to unsaved edits via [rows, stages];
  // no `view` dependency (the settlement is the same in both subcontractor views, honest on mixed).
  // Computed above the columns because the stage header's reassignment confirm quotes `byStage`,
  // so the panel and the dialog can never cite different amounts for the same etap.
  const subcontractorDue = useMemo(() => subcontractorDueByPlane(rows, stages), [rows, stages])

  // Both scenarios of the „Marża" prognoza, priced up front. The tab's plane toggle is local UI
  // state, so handing the panel one of them would force the whole row set down there to price the
  // other. Stage-blind by construction — the przedmiar is what was offered, so no `stages` dep.
  // Skipped under the preview like every other whole-row fold here: `allowedSummaryViews` drops the
  // „Marża" tab there, so this would be three passes over every pozycja for a figure no reader of the
  // client's document can reach.
  const marginForecastByPlane = useMemo(
    () => (preview ? undefined : forecastByPlane(rows)),
    [preview, rows],
  )

  // Grouped once per `rows` change, never inside `matches`: a counter calls `matches` once per
  // pozycja, so grouping there would rebuild every group ~1000 times on a large kosztorys. Empty
  // under the preview like every other whole-dataset pass here — the only rule that reads the set is
  // a diagnostic, and the client's document renders none of them.
  const divergentPriceIds = useMemo(
    () => (preview ? new Set<number>() : divergentPriceRowIds(rows)),
    [preview, rows],
  )

  // The pomiar of every pozycja, once per dataset. Six conditions ask for it and a full set of
  // counters asks ~2.6× per pozycja, each time re-summing the same ten stage columns — measured at
  // ~2 ms of the ~5 ms these memos spend on 1000 pozycji, and they run on every committed keystroke
  // (the grid commits per character, `useCellDraft`). Keyed on [rows, stages] like every reader of it.
  const qtyDoneByRowId = useMemo(() => qtyDoneByRow(rows, stages), [rows, stages])

  // Counted over the whole dataset, not over `viewRows`: once a filter is on, a count of what
  // survives it is a count of itself, and the number stops being able to reach zero to say the
  // problem is gone. Zero under the preview, like the filters themselves — the client's document
  // carries none of this. Read by the toolbar's counters.
  //
  // The two halves are counted separately because only one of them depends on the view, and the row
  // half is the expensive one: one pass over every pozycja per registry entry. Counted together,
  // switching the plane — which picking a problem now does on its own — re-ran all of them to reach
  // the same numbers.
  const rowConditionCounts = useMemo(() => {
    const ctx = {
      stages,
      hasSettledMaterial,
      divergentPriceRowIds: divergentPriceIds,
      qtyDoneByRowId,
    }
    return ROW_CONDITIONS.map(
      (condition) => [condition.id, preview ? 0 : countMatching(rows, condition.id, ctx)] as const,
    )
  }, [preview, rows, stages, hasSettledMaterial, divergentPriceIds, qtyDoneByRowId])
  // Stage counts run over the view's own etapy, not the raw list: a subcontractor view already drops
  // plane-less etapy, so counting them there would offer a filter that can only ever empty the stage
  // block. Deliberately asymmetric with the price conditions above — a price exists on both planes
  // for every pozycja, whereas an etap belongs to one.
  const stageConditionCounts = useMemo(() => {
    const viewStages = stagesForView(stages, view)
    return STAGE_CONDITIONS.map(
      (condition) =>
        [condition.id, preview ? 0 : countMatchingStages(viewStages, condition.id)] as const,
    )
  }, [preview, stages, view])
  const conditionCounts = useMemo(
    () => new Map([...rowConditionCounts, ...stageConditionCounts]),
    [rowConditionCounts, stageConditionCounts],
  )

  // Which etap problems are narrowing the stage columns. Empty under the preview like every other
  // filter, so a client's share can never be narrowed by an owner's leftover gesture.
  const engagedStageConditionIds = useMemo(
    () => (preview ? new Set<string>() : engagedStageProblemIds(engagedConditionIds)),
    [preview, engagedConditionIds],
  )

  // The columns the engaged problems are about, forced past the column picker for as long as the
  // gesture lasts. Empty under the preview: a client's document answers to its own allowlist, and an
  // owner's leftover gesture must not widen it.
  const revealedColumnIds = useMemo(
    () => columnsRevealedBy(preview ? [] : engagedConditionIds),
    [preview, engagedConditionIds],
  )

  // Gates the „Rozjazd między arkuszem Google a apką" column: it is the answer to the diagnostic beside it, so it
  // rides that button rather than the column picker. With the filter off the grid holds every pozycja
  // and the column would read „—" down nearly all of them — the button's own count is what says the
  // rozjazd is there.
  const divergenceFilterEngaged = !preview && engagedConditionIds.has(MEASURE_DIVERGED_CONDITION_ID)

  // Subtracts from the allowlist, never adds to it — the ceiling stays `PREVIEW_VISIBLE_COLUMNS`.
  const previewHiddenColumns = preview && clientView ? new Set(clientView.hiddenColumns) : undefined

  const columnOpts = {
    view,
    stages,
    onRemoveStage: editorOnly(handleRemoveStage),
    onRenameStage: editorOnly(handleRenameStage),
    onSetStagePlane: editorOnly(handleSetStagePlane),
    onSetStageWorker: editorOnly(handleSetStageWorker),
    workers,
    executedValueByStage: subcontractorDue.byStage,
    sort,
    onSetSort: editorOnly(setSortField),
    isHidden,
    moneyAxis: axis,
    layer,
    widths,
    columnRanks,
    onGuide: setGuideX,
    onCommitColumn: setWidth,
    onRemoveItem: editorOnly(handleRemoveItem),
    onReorderItem: editorOnly(handleReorderItem),
    onInsertItem: editorOnly(handleInsertItem),
    onRenameSection: editorOnly(handleRenameSection),
    onRemoveSection: editorOnly(handleRemoveSection),
    onReorderSection: editorOnly(handleReorderSection),
    onInsertSection: editorOnly(handleInsertSection),
    onPersistKosztorysOrder: editorOnly(handlePersistKosztorysOrder),
    onSetSectionColor: editorOnly(handleSetSectionColor),
    canSaveItemToCatalogue: editorOnly(true),
    getSectionItemCount: (sectionId: number) => sectionCounts.get(sectionId) ?? 0,
    globalDiscountActive,
    divergenceFilterEngaged,
    engagedStageConditionIds,
    revealedColumnIds,
    readOnly,
    previewVisible: preview,
    previewHiddenColumns,
  }
  const { columns, columnToggleItems, columnBaseRanks } = buildV2Grid(columnOpts)
  // A column sort must not outlive its column. A money-axis or view toggle can drop the sorted
  // column, taking its SortHeader — the only control that clears the sort — with it, while the sort
  // state lingers: the rows freeze in an unexplained order and the row actions stay disabled with no
  // way to re-enable them (EX-486). Forget the sort when its field stops rendering. Cleared as real
  // state, not derived, so it does not resurrect if the column later returns (owner, 2026-07-17).
  // setState during render is React's sanctioned "adjust state on an input change" path: the
  // condition bails the loop, and this render (its columns built with the stale sort) is discarded
  // before commit — the column set is sort-independent, so the retry rebuilds the same columns.
  const renderedFieldIds = new Set(
    columns.map((c) => c.id).filter((id): id is string => id != null),
  )
  if (reconcileSort(sort, renderedFieldIds) !== sort) setSort(null)

  // What the document consists of. On the owner's grid it is the FULL dataset in display order, which
  // is what makes a filter visible: the figures and the numbering skip over the rows it hid. The
  // client's document is not a filtered view of ours — it IS the offer, so under the preview the
  // owner's stored hide decision is applied first. Search and sort are deliberately left out of both:
  // a number that moved as the reader typed would name a different pozycja every keystroke.
  const documentRows = useMemo(
    () =>
      preview
        ? applyRowConditions(rows, engagedConditionIds, {
            stages,
            hasSettledMaterial,
            divergentPriceRowIds: divergentPriceIds,
            qtyDoneByRowId,
          })
        : rows,
    [
      preview,
      rows,
      engagedConditionIds,
      stages,
      hasSettledMaterial,
      divergentPriceIds,
      qtyDoneByRowId,
    ],
  )

  // Per-section subtotals: the whole document (not viewRows) — a stable breakdown independent of the
  // filter/sort. Off `documentRows` rather than `rows`, so „WC (52 poz.)" cannot stand over the four
  // pozycje a client actually receives. No money moves with it: the only rows the client's document
  // drops are empty on BOTH axes and add zero to every figure (see the 'client-empty' condition).
  const subtotals = useMemo(
    () => sectionSubtotalsForView(documentRows, stages, view),
    [documentRows, stages, view],
  )
  // Sections every one of whose pozycje match a liftable condition — the ids each „Sekcje …" row in
  // the menu ticks and unticks as a block. „Wszystkie co do jednej", never „suma = 0": a section fully
  // executed but unpriced sums to zero and is exactly the one nobody wants folded away. A mixed
  // section belongs to neither half of a pair and so stays visible under both — by design, since
  // „sekcje bez przedmiaru" cannot honestly name a section that has some.
  // Empty under the preview like every other filter input: the „Filtry" menu that reads this lives in
  // the owner's toolbar, so on a client's share there is nothing to tick.
  const foldableSectionIds = useMemo(() => {
    if (preview) return new Map<string, Set<number>>()
    const ctx = {
      stages,
      hasSettledMaterial,
      divergentPriceRowIds: divergentPriceIds,
      qtyDoneByRowId,
    }
    return new Map(
      // Skipping a condition that does not lift saves a full pass over every row for a `Map` entry the
      // menu would never read — and this memo recomputes on `rows`, i.e. on every edit. The menu
      // falls back to an empty set for a missing id, so a skipped one simply renders no „Sekcje …" row.
      ROW_CONDITIONS.filter(liftsToSections).map((condition) => [
        condition.id,
        sectionIdsWhereAllMatch(rows, condition.id, ctx),
      ]),
    )
  }, [preview, rows, stages, hasSettledMaterial, divergentPriceIds, qtyDoneByRowId])

  // Problems only, and never under the preview. The latch is half of a two-part gesture whose other
  // half — „Odśwież — ukryj poprawione" — lives in the „Problemy" menu and is rendered only while a
  // problem is engaged, so latching under a „Prace" filter would hold rows with no way to let them
  // go: untick „z przedmiarem", type a przedmiar, and the row that should leave stays put while the
  // menu's own counter moves without it. The preview is out for a different reason — the client's
  // document is not a working grid, so nothing is being fixed in it and a held-open row would only
  // be a row the owner chose to hide.
  const engagedProblems = useMemo(
    () => (preview ? new Set<string>() : engagedProblemIds(engagedConditionIds)),
    [preview, engagedConditionIds],
  )
  const { latch, refresh: refreshProblemRows } = useConditionRowLatch(
    engagedProblems,
    engagedProblems.size > 0,
  )
  const viewRows = useMemo(() => {
    const next = buildViewRows({
      rows,
      search,
      engagedConditionIds,
      sort,
      view,
      stages,
      hasSettledMaterial,
      divergentPriceRowIds: divergentPriceIds,
      qtyDoneByRowId,
      latchedRowIds: latch?.ids,
    })
    if (latch) for (const row of next) latch.ids.add(row.id)
    return next
  }, [
    rows,
    search,
    engagedConditionIds,
    sort,
    view,
    stages,
    hasSettledMaterial,
    divergentPriceIds,
    qtyDoneByRowId,
    latch,
  ])
  const ordinalByRowId = useMemo(() => baseOrdinals(documentRows), [documentRows])
  // Sections keep their original order however the filter thinned them.
  const sectionRows = useMemo(() => sectionRepresentatives(rows), [rows])
  // Executed total at the active view — the money the totals bar shows and the base the global
  // discount comes off. Full-dataset (like the subtotals): a search or section filter must not move it.
  const totalNet = useMemo(() => subtotals.reduce((s, x) => s + x.net, 0), [subtotals])
  // Σ rabatów per pozycja at the active view — the figure the global discount seeds itself from when
  // „Kwotowy" is picked, so the switch replaces without moving the total (EX-605). Reads 0 while the
  // global discount is already active (rowDiscountForView is 0 under it), which is why the seed is
  // only ever taken on the null→'amount' transition.
  // Rounded, not raw: each per-item rabat is a percent of a gross, so it has no exact binary form, and
  // summing hundreds of them surfaces the error around the 11th digit. This figure is typed straight
  // into the kwota field as text, where „172024,28000000003" is what the owner reads.
  const perItemDiscountTotal = useMemo(
    () => roundToCents(subtotals.reduce((s, x) => s + x.discount, 0)),
    [subtotals],
  )
  // How many items actually carry a rabat — what the percent bulk-overwrite would destroy. Counted off
  // the rows rather than off `subtotals`, whose discount is 0 while the global discount is active and
  // 0 in the subcontractor views; the stored per-item rabaty exist in all three cases.
  const itemsWithDiscountCount = useMemo(
    () => rows.filter((r) => r.discountValue > 0).length,
    [rows],
  )
  // Per-etap „suma transzy" at the active view — the executed value each stage delivered. Full-dataset
  // (like the subtotals): Σ over stages equals totalNet, so the etap totals and the wykonane readout
  // reconcile by construction.
  const stageTotals = useMemo(() => stageAxisForView(rows, stages, view).net, [rows, stages, view])
  // Full-dataset like every other total here, so a search never moves the two synthetic totals rows.
  const columnTotals = useMemo(
    () => columnTotalsForRows(rows, stages, view, tree.vatRate),
    [rows, stages, view, tree.vatRate],
  )
  const sectionColumnTotals = useMemo(
    () =>
      new Map(
        [...groupBySection(rows)].map(([sectionId, rowsOfSection]) => [
          sectionId,
          columnTotalsForRows(rowsOfSection, stages, view, tree.vatRate),
        ]),
      ),
    [rows, stages, view, tree.vatRate],
  )
  // The progress counter is a PROGRESS figure, not money — it must read the same in every price view,
  // so its executed/offered are weighted at the client price (a separate client-priced pass), never
  // the active `view`. Same client basis as each section's completionRatio.
  const progressSubtotals = useMemo(
    () => sectionSubtotalsForView(rows, stages, 'client'),
    [rows, stages],
  )
  // doneNet feeds the progress counter (÷ plannedNet, both post-rabat); laborCostsNetFromKosztorys + discountNetFromKosztorys
  // feed the reconciliation and route through the shared helper the investment page also calls, so the
  // two verification surfaces can't drift (reconciliation, lessons.md). All three are client-view and
  // view-independent — the progress ratio and the robocizna/rabat comparison must not move with the
  // price-view toggle.
  const { doneNet, laborCostsNetFromKosztorys, discountNetFromKosztorys, globalDiscountNet } =
    useMemo(
      () => clientTotalsFromSubtotals(progressSubtotals, globalDiscount),
      [progressSubtotals, globalDiscount],
    )
  const plannedNet = useMemo(
    () => progressSubtotals.reduce((s, x) => s + x.plannedNet, 0),
    [progressSubtotals],
  )

  // NOT the „Do zapłaty" the UI shows — that one adds materiały and subtracts wpłaty
  // (computeAmountDue). This is robocizna alone, after rabat. Both total surfaces (the Sekcje Suma
  // block and the totals bar) read this one prop, so they can never disagree.
  const laborCostsNet = doneNet - globalDiscountNet

  // revert-on-error: roll an optimistic field edit back to its pre-save value
  // (rows + diff snapshot) when the server rejects it. The "current === attempted" guard lives
  // in revertField — we don't stomp on a newer edit.
  function revertOne(
    id: number,
    field: keyof KosztorysV2RowT,
    prevVal: unknown,
    attempted: unknown,
  ) {
    setRows((rs) => revertField(rs, id, field, prevVal, attempted))
    const snap = prevById.current.get(id)
    if (snap && snap[field] === attempted) {
      prevById.current.set(id, { ...snap, [field]: prevVal } as KosztorysV2RowT)
    }
  }

  // Apply one direction of a captured grid-edit batch (undo → `before`, redo → `after`). Unlike an
  // autosave, an undo is a deliberate user action: it writes the target value immediately and updates
  // `rows` + `prevById` in lockstep so the next onChange diff doesn't re-fire the write. Each inverse
  // write goes through `runNow`, which serializes it on the cell's lane behind any in-flight forward
  // save (EX-526 #1) and routes a failed inverse through the same toast + `revertOne` rollback as a
  // forward save (EX-526 #3) — so a rejected write can't escape as an unhandled rejection or leave the
  // grid diverged from the DB.
  async function runGridReversal(
    fields: FieldChangeT[],
    stages: StageChangeT[],
    dir: 'undo' | 'redo',
  ) {
    const patchById = buildReversalPatches(fields, stages, dir)

    patchRows(
      (r) => patchById.has(r.id),
      (r) => ({ ...r, ...patchById.get(r.id) }) as KosztorysV2RowT,
    )
    // Each inverse goes through its cell's lane. On failure the lane toasts AND we roll the optimistic
    // apply back to its pre-reversal value via `revertOne` — the trailing `router.refresh()` can't do it
    // (`rows` is the mount-frozen useState seed, EX-441, so refresh reseeds the prop surfaces but not the
    // grid), so without this a rejected inverse would leave the grid diverged from the DB behind a toast.
    await Promise.all(
      planReversalWrites(fields, stages, dir).map((w) =>
        w.kind === 'field'
          ? runNow(
              w.lane,
              () => updateItemFieldAction(w.id, { [w.field]: w.value } as ItemPatchT),
              () => revertOne(w.id, w.field as keyof KosztorysV2RowT, w.restore, w.value),
            )
          : runNow(
              w.lane,
              () => setStageProgressAction(w.id, w.stageId, w.value),
              () =>
                revertOne(w.id, stageKey(w.stageId) as keyof KosztorysV2RowT, w.restore, w.value),
            ),
      ),
    )
    // Pull recomputed section/stage totals once the inverse writes have committed.
    router.refresh()
  }

  // Reverse (or replay) a ▲▼ swap: exchange the two rows' array positions and re-issue the move in
  // the given direction — the inverse of „w górę" is „w dół", so undo and redo are the same call with
  // the direction flipped. Matches handleReorderItem: no prevById touch (display_order isn't a diffed
  // field) and no totals refresh (a reorder doesn't change any figure).
  //
  // The neighbour is re-derived here rather than replayed from the one captured at push time: the
  // server exchanges with whatever is rank-adjacent NOW, so replaying a stale id would diverge the
  // moment a row landed between the pair (insert between A and X, then undo). `swapItemInSection` is
  // the same primitive the forward gesture uses, which is what makes both halves one operation.
  // A ▲▼ swap is optimistic, so a refusal has to put the pair back — otherwise the grid keeps showing
  // an order no reload can reproduce. `swapItemInSection` with the opposite direction is the exact
  // inverse of the move that was applied. Fire-and-forget only in the sense that the CALLER doesn't
  // await it; the result is never dropped.
  //
  // `command` is the undo entry the gesture pushed. Rolling the rows back without retracting it would
  // leave the stack claiming a swap that never happened, and Cmd+Z would then move the row one slot
  // PAST where it started (EX-737's rule: a retraction cancels against the command already pushed).
  // `amendTop` is identity-guarded, so anything the user did since makes this a silent no-op.
  async function persistItemSwap(itemId: number, dir: 'up' | 'down', command?: UndoCommandT) {
    const res = await swapItemOrderAction(itemId, dir)
    if (res.success) return
    setRows((rs) => swapItemInSection(rs, itemId, dir === 'up' ? 'down' : 'up'))
    if (command) amendTop(command, null)
    reportFailure(res.error, res.code)
  }

  function runReorderReversal(itemId: number, dir: 'up' | 'down') {
    setRows((rs) => swapItemInSection(rs, itemId, dir))
    void persistItemSwap(itemId, dir)
  }

  // The tree-level half of a blank row (VAT, global coefficients, the stage axis) is identical at
  // every insert point, so the three callers spell out only what differs: which row, in which section.
  type BlankRowIdentityT = Pick<
    BlankRowInputT,
    'id' | 'displayOrder' | 'sectionId' | 'sectionName' | 'sectionColor'
  >
  function makeBlankRow(identity: BlankRowIdentityT) {
    return buildBlankRow({
      ...identity,
      vatRate: tree.vatRate,
      globalDiscountActive,
      globalWToolsCoeff: tree.globalCoeffs.wTools,
      globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
      stages,
    })
  }

  async function handleAddItem(sectionId: number) {
    const res = await addItemAction(sectionId)
    if (!res.success) return reportFailure(res.error, res.code)
    // Take the denormalized section fields from any existing row of that section.
    const sample = [...prevById.current.values()].find((r) => r.sectionId === sectionId)
    const row = makeBlankRow({
      id: res.data.id,
      displayOrder: res.data.displayOrder,
      sectionId,
      sectionName: sample?.sectionName ?? DEFAULT_SECTION_NAME,
      sectionColor: sample?.sectionColor ?? null,
    })
    prevById.current.set(row.id, row)
    setRows((rs) => applyAddItem(rs, row))
    unfoldSection(sectionId)
  }

  // ⋯ menu → Wstaw pozycję powyżej/poniżej. Inserts a blank row at the anchor's display slot
  // (±1) within the anchor's section. "Above/below" has no meaning against a price-sorted view, so
  // it's a no-op while a column sort is active (the menu also disables it). Denormalized section
  // fields come from any existing row of that section (as in handleAddItem).
  async function handleInsertItem(anchorRow: KosztorysV2RowT, dir: 'above' | 'below') {
    if (sort) return
    const res = await insertItemAction(anchorRow.id, dir)
    if (!res.success) return reportFailure(res.error, res.code)
    const sample =
      [...prevById.current.values()].find((r) => r.sectionId === anchorRow.sectionId) ?? anchorRow
    const row = makeBlankRow({
      id: res.data.id,
      displayOrder: res.data.displayOrder,
      sectionId: anchorRow.sectionId,
      sectionName: sample.sectionName,
      sectionColor: sample.sectionColor,
    })
    prevById.current.set(row.id, row)
    setRows((rs) => applyInsertItem(rs, anchorRow.id, row, dir))
  }

  async function handleRemoveItem(row: KosztorysV2RowT) {
    // Decided at event time against the full dataset (prevById), not the view, so a filtered or
    // searched grid can't make a row look like the last one in its section.
    if (isLastItemInSection([...prevById.current.values()], row)) {
      await handleRemoveSection(row.sectionId)
      return
    }
    const rowsAtRemoval = rowsRef.current
    const removedAt = rowsAtRemoval.findIndex((r) => r.id === row.id)
    const afterId = removedAt > 0 ? rowsAtRemoval[removedAt - 1].id : null
    prevById.current.delete(row.id)
    dropHeight(String(row.id))
    setRows((rs) => applyRemoveItem(rs, row.id))
    // Flush any still-buffering burst into a command first, then drop every stack command touching the
    // deleted row — otherwise undoing one would fire writes against a dead id and `setStageProgressAction`
    // (an absolute upsert) could recreate an orphan stage row (EX-526 #2).
    flushUndoBuffer()
    pruneByIds([row.id])
    const res = await removeItemAction(row.id)
    if (!res.success) {
      // Server rejected (client/server predicate drift) — restore the row after the neighbor it
      // followed, resolved against the current rows so a concurrent edit during the await can't
      // misplace it (applyAddItem would re-append it at the grid's end). The pruned undo history for
      // this row stays gone — a rare failure path on throwaway data, not worth reconstructing.
      prevById.current.set(row.id, row)
      setRows((rs) => applyRestoreItem(rs, row, afterId))
      reportFailure(res.error, res.code)
    }
  }

  function handleReorderItem(row: KosztorysV2RowT, dir: 'up' | 'down') {
    const rs = rowsRef.current
    const neighbor = sectionNeighbor(rs, row.id, dir)
    if (!neighbor) return // edge of the block → no-op
    setRows(swapItemInSection(rs, row.id, dir))
    const back = dir === 'up' ? 'down' : 'up'
    // Built before the write so a refusal can retract exactly this entry; pushed after it, because
    // the push is synchronous and the rejection can only land in a later tick.
    const command: UndoCommandT = {
      label: 'Zmiana kolejności',
      undo: () => runReorderReversal(row.id, back),
      redo: () => runReorderReversal(row.id, dir),
      touchedIds: [row.id, neighbor.id],
    }
    // ▲▼ is a swap of two neighbors → the server exchanges just their display_order (2 updates, not a
    // renumbering of the whole section — that choked with 1000+ rows). The action fires from the
    // event handler, not from the setRows updater (there its cache revalidation would move the Router during render).
    void persistItemSwap(row.id, dir, command)
    pushCommand(command)
  }

  // Menu nagłówka → „Zapisz kolejność": the active sort is only a view, so this is what makes it
  // survive a reload — every section's rows take display_order 0…n-1 in the order they're shown.
  // Computed from `rows`, never `viewRows`: the search box would otherwise renumber the visible
  // rows and leave the hidden ones interleaved among them.
  //
  // One server call for the whole sheet, so a half-applied bake can't leave some sections renumbered
  // and others not.
  // `revertTo` is the sequence to fall back to when the server refuses the whole write — one stale id
  // (a row deleted in another tab) rejects the entire bake, and without the rollback the grid would
  // keep showing an order no reload can reproduce.
  async function runKosztorysRenumber(next: number[], revertTo: number[]) {
    setRows((rs) => applyKosztorysOrder(rs, next))
    const res = await renumberKosztorysOrderAction(investmentId, next)
    if (!res.success) {
      setRows((rs) => applyKosztorysOrder(rs, revertTo))
      reportFailure(res.error, res.code)
    }
  }

  function handlePersistKosztorysOrder() {
    // Scope-blind on purpose: the plan renumbers each section by the same sort key either way, so a
    // global sort bakes exactly what „w sekcjach" would. What it does NOT preserve is the interleaved
    // view itself — rows fall back under their own sections once the sort is cleared.
    if (!sort) return
    const { before, after } = planKosztorysRenumber(
      rowsRef.current,
      (r) => columnSortValue(r, sort.field, view, stages),
      sort.dir,
    )
    if (after.length === 0) return
    void runKosztorysRenumber(after, before)
    pushCommand({
      label: 'Zapisanie kolejności',
      undo: () => void runKosztorysRenumber(before, after),
      redo: () => void runKosztorysRenumber(after, before),
      touchedIds: after,
    })
  }

  // Section twin of persistItemSwap, down to the rollback and the undo retraction.
  async function persistSectionSwap(sectionId: number, dir: 'up' | 'down', command?: UndoCommandT) {
    const res = await swapSectionOrderAction(sectionId, dir)
    if (res.success) return
    setRows((rs) => swapSectionBlock(rs, sectionId, dir === 'up' ? 'down' : 'up'))
    if (command) amendTop(command, null)
    reportFailure(res.error, res.code)
  }

  // Mirrors handleReorderItem one level up: the grid regroups its blocks, the DB exchanges the two sections' display_order (2 updates, not a renumbering). Returns
  // false at the edge so the undo command isn't pushed for a no-op.
  function applySectionSwap(sectionId: number, dir: 'up' | 'down', command?: UndoCommandT) {
    if (neighborSectionId(rowsRef.current, sectionId, dir) == null) return false
    setRows((rs) => swapSectionBlock(rs, sectionId, dir))
    void persistSectionSwap(sectionId, dir, command)
    return true
  }

  function handleReorderSection(sectionId: number, dir: 'up' | 'down') {
    // „w górę/w dół" has no meaning against a price-sorted view (the menu also disables it).
    if (sort) return
    // Captured BEFORE the swap: deleting the section later prunes this command, so an undo can
    // never re-derive a neighbour from rows the section no longer has.
    const touchedIds = rowsRef.current.filter((r) => r.sectionId === sectionId).map((r) => r.id)
    const back = dir === 'up' ? 'down' : 'up'
    const command: UndoCommandT = {
      label: 'Zmiana kolejności sekcji',
      undo: () => void applySectionSwap(sectionId, back),
      redo: () => void applySectionSwap(sectionId, dir),
      touchedIds,
    }
    if (!applySectionSwap(sectionId, dir, command)) return
    pushCommand(command)
  }

  // The first row of a brand-new section: the section's own fields are still the defaults the action
  // just wrote, so they come from DEFAULT_SECTION_NAME rather than a round trip.
  function buildNewSectionRow(sectionId: number, item: { id: number; displayOrder: number }) {
    return makeBlankRow({
      id: item.id,
      displayOrder: item.displayOrder,
      sectionId,
      sectionName: DEFAULT_SECTION_NAME,
      sectionColor: null,
    })
  }

  // ⋯ → Sekcje → Wstaw powyżej/poniżej. The section-level twin of handleInsertItem: a new section
  // (plus its first blank item — a 0-item section renders as 0 rows) lands right before or after the
  // anchor section instead of at the end.
  async function handleInsertSection(anchorSectionId: number, dir: 'above' | 'below') {
    if (sort) return
    const res = await insertSectionAction(anchorSectionId, dir)
    if (!res.success) return reportFailure(res.error, res.code)
    const row = buildNewSectionRow(res.data.section.id, res.data.item)
    prevById.current.set(row.id, row)
    setRows((rs) => applyInsertSectionRow(rs, anchorSectionId, row, dir))
  }

  async function handleAddSection() {
    const res = await addSectionAction(investmentId)
    if (!res.success) return reportFailure(res.error, res.code)
    const row = buildNewSectionRow(res.data.section.id, res.data.item)
    prevById.current.set(row.id, row)
    setRows((rs) => applyAddItem(rs, row))
  }

  // Append the sections returned by appendPresetSectionsAction to the grid without a reload. The rows
  // are built through treeToRows (the same denormalization as the initial load), using the CURRENT
  // stages + global discount so the appended rows carry today's stage columns and rabat flag — the
  // action already committed with real ids, so no temp-id reconciliation. router.refresh() alone
  // can't add them (mount-frozen `rows`, EX-441); it still runs for the prop-reading surfaces.
  function handleAppendedSections(slice: KosztorysTreeT['sections']) {
    const appended = treeToRows({
      sections: slice,
      stages,
      progress: [],
      globalCoeffs: tree.globalCoeffs,
      vatRate: tree.vatRate,
      settlementMode: tree.settlementMode,
      materialsNetRate: tree.materialsNetRate,
      globalDiscount,
      revision: tree.revision,
    })
    for (const row of appended) prevById.current.set(row.id, row)
    setRows((rs) => [...rs, ...appended])
    router.refresh()
  }

  // The twin of handleAppendedSections for prace inserted into an EXISTING sekcja. It cannot append
  // to the array's end: the grid walks rows in order to build its section bands, so a row parked past
  // a later section would open a second band for a section that already has one. Each row therefore
  // goes through applyAddItem, which lands it after the last row of its own sekcja — and folding them
  // in order keeps the katalog's selection order, since each new row becomes the next one's anchor.
  function handleAppendedCatalogueItems(slice: KosztorysTreeT['sections'][number]) {
    const appended = treeToRows({
      sections: [slice],
      stages,
      progress: [],
      globalCoeffs: tree.globalCoeffs,
      vatRate: tree.vatRate,
      settlementMode: tree.settlementMode,
      materialsNetRate: tree.materialsNetRate,
      globalDiscount,
      revision: tree.revision,
    })
    for (const row of appended) prevById.current.set(row.id, row)
    setRows((rs) => appended.reduce(applyAddItem, rs))
    unfoldSection(slice.id)
    router.refresh()
  }

  async function handleRemoveSection(sectionId: number) {
    // The summary confirms before calling here (EX-477); a populated section cascade-deletes its
    // items + stage_progress server-side, guarded only by the confirm dialog, not a block.
    const removed = rowsRef.current
      .filter((r) => r.sectionId === sectionId)
      .map((r) => prevById.current.get(r.id) ?? r)
    setRows((rs) => rs.filter((r) => r.sectionId !== sectionId))
    // The section's band and footer carry heights of their own — they have a handle too.
    dropHeight(
      ...removed.map((r) => String(r.id)),
      String(sectionHeaderRowId(sectionId)),
      String(sectionFooterRowId(sectionId)),
    )
    for (const [id, r] of prevById.current) {
      if (r.sectionId === sectionId) prevById.current.delete(id)
    }
    // Drop stack commands touching any of the cascade-deleted rows (EX-526 #2) — see handleRemoveItem.
    flushUndoBuffer()
    pruneByIds(removed.map((r) => r.id))
    // collapsedSectionIds is left alone: with no rows there is no band to fold, so a leftover id is
    // inert — and it keeps the section's fold state if the server rejects and the rows come back.
    const res = await removeSectionAction(sectionId)
    if (!res.success) {
      // Server rejected (predicate drift) — restore the section's rows and surface the block.
      for (const r of removed) prevById.current.set(r.id, r)
      setRows((rs) => [...rs, ...removed])
      reportFailure(res.error, res.code)
    }
  }

  // A section field is denormalized on every row of the section, so setting one patches them all
  // (rows + prevById) and persists once.
  const SECTION_ROW_FIELDS = { sectionName: 'name', sectionColor: 'color' } as const
  type SectionRowFieldT = keyof typeof SECTION_ROW_FIELDS

  // Extracted from the handler so undo/redo can re-run it with the before/after value. The forward
  // write debounces on the field's own lane: the colour picker is built for repeated picking (plain
  // buttons, so the menu stays open while you compare tints), so browsing the palette is a burst and
  // each pick would otherwise cost an auth round trip plus an UPDATE. `immediate` is what undo/redo
  // pass — the inverse write pre-empts a still-pending forward save instead of racing it (EX-526 #1).
  function applySectionField<K extends SectionRowFieldT>(
    sectionId: number,
    rowKey: K,
    value: KosztorysV2RowT[K],
    { immediate = false }: { immediate?: boolean } = {},
  ) {
    patchRows(
      (r) => r.sectionId === sectionId,
      (r) => ({ ...r, [rowKey]: value }),
    )
    // No revert-on-error, unlike the cell savers: a section's colour and name are cosmetic, so the
    // lane's toast is enough — yanking the swatch back mid-browse costs more than the stale tint.
    const persist = immediate ? runNow : save
    persist(`section-field:${sectionId}:${rowKey}`, () =>
      updateSectionFieldAction(sectionId, { [SECTION_ROW_FIELDS[rowKey]]: value }),
    )
  }

  // Bails on a no-op write: the Sekcja cell's onBlur fires on every focus-out and the colour picker
  // stays open across clicks, so both can re-send the value they already hold.
  function handleSetSectionField<K extends SectionRowFieldT>(
    sectionId: number,
    rowKey: K,
    value: KosztorysV2RowT[K],
    undoLabel: string,
  ) {
    const before = rowsRef.current.find((r) => r.sectionId === sectionId)?.[rowKey]
    if (before === undefined || before === value) return
    applySectionField(sectionId, rowKey, value)
    pushReversible(
      undoLabel,
      (v: KosztorysV2RowT[K]) => applySectionField(sectionId, rowKey, v, { immediate: true }),
      before,
      value,
    )
  }

  function handleSetSectionColor(sectionId: number, color: SectionColorKeyT | null) {
    handleSetSectionField(sectionId, 'sectionColor', color, 'Zmiana koloru sekcji')
  }

  function handleRenameSection(sectionId: number, name: string) {
    handleSetSectionField(sectionId, 'sectionName', name, 'Zmiana nazwy sekcji')
  }

  // Optimistic patch of a denormalized field on the matching rows + prevById (like
  // handleRenameSection for sectionName). The markup coefficients are denormalized on
  // EVERY row, but they are changed OUTSIDE the grid (the panel). router.refresh() alone won't
  // pick them up: `rows` lives in useState with an initializer that runs once at mount, so a
  // refreshed `tree` prop does not reinitialize the rows — without this patch the "Cena" column
  // would show the stale value until a reload.
  function patchRows(
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) {
    setRows((rs) => rs.map((r) => (match(r) ? patch(r) : r)))
    for (const [id, r] of prevById.current) {
      if (match(r)) prevById.current.set(id, patch(r))
    }
  }

  function onChange(next: KosztorysV2RowT[]) {
    // The public page's own guard, narrower than the lock: a zakończona inwestycja is stopped one
    // layer out by `disabled: true` on every column, so nothing here can fire for it — but a preview
    // grid is served to an anonymous visitor, and that one gets a belt as well as braces.
    if (preview) return
    const { fieldChanges, stageChanges, changedById } = planGridChanges(next, prevById.current)
    for (const c of fieldChanges) {
      const key = c.field as keyof KosztorysV2RowT
      save(
        itemFieldLane(c.id, c.field),
        () => updateItemFieldAction(c.id, { [c.field]: c.after } as ItemPatchT),
        () => {
          revertOne(c.id, key, c.before, c.after)
          dropPendingField(c.id, c.field)
        },
      )
    }
    // Stage progress is a distinct save dimension (sparse upsert), keyed per item×stage.
    for (const c of stageChanges) {
      const key = stageKey(c.stageId) as keyof KosztorysV2RowT
      save(
        stageLane(c.id, c.stageId),
        () => setStageProgressAction(c.id, c.stageId, c.after),
        () => {
          revertOne(c.id, key, c.before, c.after)
          dropPendingStage(c.id, c.stageId)
        },
      )
    }
    // Advance the snapshot over the array the grid already handed us, rather than a copy of it the
    // plan would have to allocate per keystroke. Rows absent from the snapshot stay absent — that is
    // the same "never seen, nothing to diff" skip planGridChanges applies.
    for (const row of next) if (prevById.current.has(row.id)) prevById.current.set(row.id, row)
    // One onChange batch (incl. a multi-cell paste) = one composite undo entry: buffer them all and
    // let the timer collapse the burst into a single coalesced command.
    if (fieldChanges.length > 0 || stageChanges.length > 0) {
      pendingFields.current.push(...fieldChanges)
      pendingStages.current.push(...stageChanges)
      setHasPendingBurst(true)
      if (flushTimer.current) clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(flushUndoBuffer, UNDO_COALESCE_MS)
    }
    if (changedById.size > 0) {
      // Merge the view's changes into the full dataset by id (so filter/sort don't lose hidden rows).
      setRows((master) => master.map((r) => changedById.get(r.id) ?? r))
      // Pull the recomputed totals from the server after the save quiets down (only when
      // something actually changed — an unconditional refresh on a spurious onChange could loop the render).
      // Restarting the timer is what makes "quiets down" true: unclamped, a run of edited cells queues one
      // full-route refresh each, which is exactly the cost `deferRefresh` removed from the autosave itself.
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => router.refresh(), TOTALS_REFRESH_DEBOUNCE_MS)
    }
  }

  return {
    // The whole rozpiska, unfiltered and unsorted — „Wybierz pozycję z katalogu prac" reads it to
    // tell which cennik prace are already in. viewRows would answer for the active filter instead.
    rows,
    // grid data + layout
    gridRef,
    gridNode,
    gridHeight,
    columns,
    columnToggleItems,
    revealedColumnIds,
    toggleColumn,
    setAllColumns,
    columnRanks,
    columnBaseRanks,
    setColumnRank,
    resetColumnOrder,
    moneyAxis: axis,
    setMoneyAxis,
    layer,
    setLayer,
    viewRows,
    view,
    sort,
    guideX,
    guideY,
    rowHeights,
    // The handle's callbacks are composed one layer out, in the body: fitting a row to its text
    // needs the measured column widths, which only the rendered grid knows.
    setRowHeight,
    setGuideY,
    collapsedSectionIds,
    storedCollapsedSectionIds,
    toggleSectionCollapsed,
    setCollapsedSectionIds,
    // The band's only mutation — every other section command lives in the row „…" menu. Reused from
    // columnOpts rather than gated a second time, so the band and the name cell can't disagree about
    // whether renaming is allowed.
    onRenameSection: columnOpts.onRenameSection,
    // subtotals + section panel
    subtotals,
    // client-priced, view-invariant per-section subtotals — the section pie's structure source.
    progressSubtotals,
    totalNet,
    columnTotals,
    sectionColumnTotals,
    stageTotals,
    stages,
    doneNet,
    laborCostsNetFromKosztorys,
    discountNetFromKosztorys,
    plannedNet,
    globalDiscount,
    perItemDiscountTotal,
    itemsWithDiscountCount,
    isSavingSettings,
    investorImpactConfirm,
    subcontractorDue,
    marginForecastByPlane,
    laborCostsNet,
    // toolbar / panel state
    setView,
    search,
    setSearch,
    engagedConditionIds,
    engagedStageConditionIds,
    toggleCondition,
    toggleConditionExclusive,
    refreshProblemRows,
    resetFilters,
    conditionCounts,
    foldableSectionIds,
    ordinalByRowId,
    sectionRows,
    // Read by the toolbar and the summary through the editor context: on a locked investment they
    // drop their own write entries, which `editorOnly` (a grid-callback gate) never reaches.
    readOnly,
    // handlers
    onChange,
    handleAddItem,
    handleAddSection,
    handleAppendedSections,
    handleAppendedCatalogueItems,
    handleAddStage,
    handleGlobalCoeffChange,
    handleVatChange,
    handleSettlementModeChange,
    handleMaterialsNetRateChange,
    handleGlobalDiscountChange,
    handleApplyPercentDiscount,
    // undo/redo (stack lives in the shell; consumed by the toolbar + keyboard). Both flush a
    // still-buffering edit burst first, so an undo pops the just-typed edit (correct LIFO) rather
    // than an older command that the un-pushed burst is sitting in front of.
    undo: () => {
      flushUndoBuffer()
      undo()
    },
    redo: () => {
      flushUndoBuffer()
      redo()
    },
    ...undoAvailability(canUndo, canRedo, hasPendingBurst),
  }
}
