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
  catalogueSlicePlacement,
  groupBySection,
  neighborSectionId,
  revertField,
  sectionNeighbor,
  swapItemInSection,
  swapSectionBlock,
  type BlankRowInputT,
} from '@/lib/kosztorys/row-ops'
import { isLastItemInSection } from '@/lib/kosztorys/delete-policy'
import { columnTotalsForRows } from '@/lib/kosztorys/column-totals'
import { sectionSubtotalsForView, stageAxisForView } from '@/lib/kosztorys/settlement-aggregates'
import { clientTotalsFromSubtotals } from '@/lib/kosztorys/settlement-client-totals'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import { marginForecastByPlane as forecastByPlane } from '@/lib/kosztorys/margin-forecast'
import { divergentPriceRowIds } from '@/lib/kosztorys/price-divergence'
import { qtyDoneByRow } from '@/lib/kosztorys/row-conditions/ctx'
import { buildViewRows } from '@/lib/kosztorys/row-view'
import { computeMoveEdges } from '@/lib/kosztorys/move-edges'
import { orderCommandsEnabled } from '@/lib/kosztorys/order-commands'
import {
  applyRowConditions,
  columnsRevealedBy,
  countMatching,
  liftsToSections,
  rowIdsMatching,
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
import { applyCatalogueToKosztorysAction } from '@/lib/actions/work-catalogue'
import { buildCatalogueComparison } from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import type { ItemPatchT, KosztorysTreeT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { SeedConflictFieldT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { toastMessage } from '@/lib/utils/toast'
import type { WorkerRefT } from '@/types/reference-data'

type ArgsT = {
  investmentId: number
  tree: KosztorysTreeT
  // The read-only client render — both the public share link and „Podgląd dla inwestora". Distinct
  // from `view === 'client'`, which is a PRICE PLANE; the render mode pins that plane, so the two must
  // not share the word (owner ruling 2026-07-28).
  preview?: boolean
  // Only consumed under `preview` — the owner's editor has none, and the settings dialog reads its own.
  clientView?: ClientViewSettingsT
  // „Zakończona" — the server refuses every write. Kept apart from `preview`: the two agree on
  // interaction and disagree on disclosure, and a locked investment is still the owner's OWN document.
  locked?: boolean
  undoRedo: UndoRedoApiT
  // Absent on the client share path, which renders no menu.
  workers?: WorkerRefT[]
  // Gate on the overpaid-crew problem (EX-708). Defaults false for client-share, which counts none.
  hasSettledMaterial?: boolean
  // The whole cennik, for the two katalog problems. Absent on the podglądy, where its absence is
  // what switches both rows off — an empty array would mean „nothing is in the cennik".
  workCatalogue?: WorkCatalogueItemT[]
  // Reseed-the-whole-tree path for a write that returns NOT_FOUND. Absent on the read-only body.
  onStaleTree?: () => Promise<void>
  // The szablon workbench — the grid narrows to what a szablon carries. A boolean, not the id:
  // the hook has no use for the id, and `buildV2Grid` runs unmemoized, so the value must be stable.
  isWorkshop?: boolean
}

// Longer than the debounced save (500ms) so a burst is captured only once its writes are scheduled.
const UNDO_COALESCE_MS = 700
// Separate knob from UNDO_COALESCE_MS despite the matching value — that one sizes an undo entry, this
// one decides when the server's recomputed totals are worth a round trip.
const TOTALS_REFRESH_DEBOUNCE_MS = 700

const NO_ROW_IDS: ReadonlySet<number> = new Set()

// Handlers never fire an action from inside a setRows updater — that would move the Router during
// render.
export function useKosztorysEditor({
  investmentId,
  tree,
  preview = false,
  clientView,
  locked = false,
  undoRedo,
  workers,
  hasSettledMaterial = false,
  workCatalogue,
  onStaleTree,
  isWorkshop = false,
}: ArgsT) {
  // Interaction, split from disclosure: `preview` decides what a client is SHOWN, this decides whether
  // anything may be written.
  const readOnly = preview || locked
  const router = useRouter()
  const { recoverStaleTree, reportFailure } = useStaleTreeRecovery(onStaleTree)
  const { save, runNow } = useDebouncedSave(500, recoverStaleTree)
  // Owned by the shell (KosztorysEditorV2). Capture pushes here; toolbar + keyboard call undo/redo.
  const { push, undo, redo, canUndo, canRedo, pruneByIds, amendTop } = undoRedo
  const [gridRef, gridHeight, gridNode] = useElementHeight()
  // The row store looks like the obvious fourth extraction after settlement/stage-ops/view-state and
  // isn't (EX-702): those had narrow seams, this has ~47 references across ~30 handlers, so pulling it
  // out leaves every call site reaching in — the indirection on the hot path EX-496 was reverted over.
  // Settle EX-422 first: if rowsRef/prevById stop being load-bearing, what's left to extract is smaller.
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() => treeToRows(tree))
  const {
    view,
    setView,
    search,
    setSearch,
    engagedConditionIds,
    showAllRows,
    setShowAllRows,
    toggleCondition,
    setConditions,
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
    fitRowsToContent,
    toggleFitRowsToContent,
  } = useKosztorysViewState({ investmentId, preview, clientView, isWorkshop })

  // Committed on handle release, not per pointermove — that would be a write per pixel.
  const { widths, setWidth, dropWidth } = useColumnWidths()
  const { heights: rowHeights, setHeight: setRowHeight, dropHeight } = useRowHeights()
  const { isHidden, toggleColumn, setAllColumns } = useHiddenColumns()
  const {
    ranks: columnRanks,
    setRank: setColumnRank,
    resetOrder: resetColumnOrder,
  } = useColumnOrder()
  const [moneyAxis, setMoneyAxis] = useMoneyAxis()
  // Nothing here is pinned for a preview: selectV2Columns drops every gate but the allowlist, so the
  // axis, layer and picker never reach the client's grid at all.
  const axis = effectiveMoneyAxis(view, moneyAxis)
  const [layer, setLayer] = useLayer()
  // Previous rows keyed by item id — the full dataset, not the view. Doubles as the fresh dataset that
  // structural handlers read, so no separate rows ref is needed.
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))
  // Latest-value ref: the fresh `rows` read during an event-time reorder, since firing an action inside
  // the setRows updater would move the Router during render.
  // EX-422: introduced to dodge a mount-frozen column closure that no longer exists (the grid is on the
  // reactive `DynamicDataSheetGrid` as of `ee497cb`). Kept as the rollback path — whether they still
  // earn their place is EX-422's follow-up, not a freebie to delete alongside it.
  const rowsRef = useRef(rows)

  // Deliberate latest-value pattern, described above.
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

  // onChange appends each keystroke here; the flush timer collapses them into one command (UNDO_COALESCE_MS).
  const pendingFields = useRef<FieldChangeT[]>([])
  const pendingStages = useRef<StageChangeT[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Reactive mirror of „a burst is buffering" (the refs aren't), so the toolbar button and Cmd+Z agree
  // during the coalesce window instead of the button staying greyed while the shortcut works (EX-526 #5).
  const [hasPendingBurst, setHasPendingBurst] = useState(false)

  // Kept with the burst it captured so the next flush can tell whether it retracts it (EX-737). Only
  // read behind `amendTop`'s identity guard, which is what makes a stale entry here harmless.
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

  // Collapse the burst into one command (before=first, after=last), dropping a net-zero burst so it
  // never lands a dead entry. A burst that takes back the command on top cancels against it too.
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

  // If a failed save empties the burst buffers, cancel the pending flush and clear the reactive flag —
  // otherwise Undo stays enabled for the rest of the window with nothing to flush.
  function clearBurstIfEmpty() {
    if (pendingFields.current.length > 0 || pendingStages.current.length > 0) return
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    setHasPendingBurst(false)
  }

  // Pull a reverted change out of the buffered burst (EX-526 #4), then re-check whether that emptied it.
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

  // A restore remounts the body: drop dangling timers so a pending flush can't close over the outgoing
  // mount's setRows, and a pending refresh can't re-render a route the user has left.
  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [])

  // Flush any buffering grid edit first, so a burst typed just before keeps its LIFO place on the stack.
  function pushCommand(cmd: Parameters<typeof push>[0]) {
    flushUndoBuffer()
    push(cmd)
  }

  // Direction is expressed by which argument is replayed, so undo and redo share one function.
  function pushReversible<T>(label: string, apply: (state: T) => void, before: T, after: T) {
    pushCommand({ label, undo: () => apply(before), redo: () => apply(after) })
  }

  // `columnOpts` reads globalDiscountActive and the settings handlers. `patchRows` and `pushReversible`
  // are function declarations, so passing them here is safe despite patchRows being written below.
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

  // These read stable refs from a cell's onClick, never during render, so passing them here is safe.
  // Under preview buildV2Grid disables every cell and drops the action column, so every data-mutation
  // callback is dropped — no control survives that could fire them. Column resize is the exception: it
  // moves a localStorage width only. Sort is dropped, so the client sees a fixed order. The gate is the
  // render mode plus the investment's state, NOT a role — nobody edits a closed kosztorys.
  const editorOnly = <T>(handler: T): T | undefined => (readOnly ? undefined : handler)

  // View-INDEPENDENT: each etap valued at its own plane's price, so the settlement is the same in both
  // subcontractor views. Computed above the columns because the stage header's reassignment confirm
  // quotes `byStage`, so panel and dialog can never cite different amounts for one etap.
  const subcontractorDue = useMemo(() => subcontractorDueByPlane(rows, stages), [rows, stages])

  // Both priced up front: the tab's plane toggle is local UI state, so handing the panel one would force
  // the whole row set down there to price the other. Stage-blind — the przedmiar is what was offered.
  // Skipped under preview, where `allowedSummaryViews` drops the „Marża" tab entirely.
  const marginForecastByPlane = useMemo(
    () => (preview ? undefined : forecastByPlane(rows)),
    [preview, rows],
  )

  // Grouped here, never inside `matches`: a counter calls `matches` once per pozycja, so grouping there
  // would rebuild every group ~1000 times on a large kosztorys.
  const divergentPriceIds = useMemo(
    () => (preview ? new Set<number>() : divergentPriceRowIds(rows)),
    [preview, rows],
  )

  // The whole rozpiska read against the cennik, once per committed change — the same comparison the
  // „Porównaj z katalogiem prac" window renders, so the counters and the window can never disagree.
  // Hand-written memo: the compiler quietly bails in this file (EX-496), and this is the one call
  // here whose cost is worth a dependency list. The coefficients come from a ROW, not from `tree`:
  // the owner changes them mid-session and the settings hook patches them onto the rows (which is
  // where it reads them back from too), while `tree` still carries what the server last served.
  //
  // Hints are deliberately NOT attached here: scoring every praca against every cennik opis is
  // seconds, not milliseconds, and belongs where somebody is reading them (the window).
  const catalogueComparison = useMemo(() => {
    if (preview || !workCatalogue || rows.length === 0) return null
    return buildCatalogueComparison(rows, workCatalogue, {
      wToolsCoeff: rows[0].globalWToolsCoeff,
      ownToolsCoeff: rows[0].globalOwnToolsCoeff,
    })
  }, [preview, rows, workCatalogue])

  const catalogueRowIds = useMemo(
    () =>
      catalogueComparison
        ? {
            divergent: new Set(catalogueComparison.diffs.map((diff) => diff.itemId)),
            missing: new Set(catalogueComparison.missing.map((row) => row.itemId)),
          }
        : undefined,
    [catalogueComparison],
  )

  // Six conditions and a full set of counters ask for this ~2.6× per pozycja, each re-summing the same
  // ten stage columns — ~2ms of the ~5ms these memos spend on 1000 pozycji, on every committed keystroke.
  const qtyDoneByRowId = useMemo(() => qtyDoneByRow(rows, stages), [rows, stages])

  // Counted over the whole dataset: once a filter is on, a count of what survives it is a count of
  // itself and can never reach zero to say the problem is gone.
  // The two halves are counted separately because only the stage half depends on the view and the row
  // half is the expensive one — counted together, switching the plane re-ran all of them for the same numbers.
  const rowConditionCounts = useMemo(() => {
    const ctx = {
      stages,
      hasSettledMaterial,
      divergentPriceRowIds: divergentPriceIds,
      qtyDoneByRowId,
      catalogueRowIds,
    }
    return ROW_CONDITIONS.map(
      (condition) => [condition.id, preview ? 0 : countMatching(rows, condition.id, ctx)] as const,
    )
  }, [
    preview,
    rows,
    stages,
    hasSettledMaterial,
    divergentPriceIds,
    qtyDoneByRowId,
    catalogueRowIds,
  ])
  // What the owner's „Ukryj pozycje…" takes out of the client's document: its size labels the
  // investor's „Pokaż wszystkie pozycje", and its members render muted once they are shown. Asked
  // even while the switch is on — the rule is what the owner stored, not what is currently hidden.
  const clientEmptyRowIds = useMemo(
    () =>
      preview && clientView?.hideEmptyRows
        ? rowIdsMatching(rows, 'client-empty', {
            stages,
            hasSettledMaterial,
            divergentPriceRowIds: divergentPriceIds,
            qtyDoneByRowId,
            catalogueRowIds,
          })
        : NO_ROW_IDS,
    [
      preview,
      clientView?.hideEmptyRows,
      rows,
      stages,
      hasSettledMaterial,
      divergentPriceIds,
      qtyDoneByRowId,
      catalogueRowIds,
    ],
  )
  // Over the view's own etapy: a subcontractor view already drops plane-less etapy, so counting the raw
  // list would offer a filter that can only empty the stage block. Asymmetric with the price conditions
  // by design — a price exists on both planes, an etap belongs to one.
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

  // Empty under preview, so a client's share can't be narrowed by an owner's leftover gesture.
  const engagedStageConditionIds = useMemo(
    () => (preview ? new Set<string>() : engagedStageProblemIds(engagedConditionIds)),
    [preview, engagedConditionIds],
  )

  // Forced past the column picker for as long as the gesture lasts. Empty under preview: a client's
  // document answers to its own allowlist.
  const revealedColumnIds = useMemo(
    () => columnsRevealedBy(preview ? [] : engagedConditionIds),
    [preview, engagedConditionIds],
  )

  // The column is the answer to the diagnostic beside it, so it rides that button, not the column
  // picker — unfiltered it would read „—" down nearly every row.
  const divergenceFilterEngaged = !preview && engagedConditionIds.has(MEASURE_DIVERGED_CONDITION_ID)

  // Subtracts from the allowlist, never adds to it — the ceiling stays `PREVIEW_VISIBLE_COLUMNS`.
  const previewHiddenColumns = preview && clientView ? new Set(clientView.hiddenColumns) : undefined

  // Which ▲/▼ the two menus may offer at all. Off `rows`, like the movers themselves.
  const moveEdges = useMemo(() => computeMoveEdges(rows), [rows])

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
    moveEdges,
    onInsertItem: editorOnly(handleInsertItem),
    onRenameSection: editorOnly(handleRenameSection),
    onRemoveSection: editorOnly(handleRemoveSection),
    onReorderSection: editorOnly(handleReorderSection),
    onInsertSection: editorOnly(handleInsertSection),
    onSetSectionColor: editorOnly(handleSetSectionColor),
    onPersistKosztorysOrder: editorOnly(handlePersistKosztorysOrder),
    canSaveItemToCatalogue: editorOnly(true),
    globalDiscountActive,
    divergenceFilterEngaged,
    engagedStageConditionIds,
    revealedColumnIds,
    readOnly,
    previewVisible: preview,
    previewHiddenColumns,
    workshopVisible: isWorkshop,
  }
  const { columns, columnToggleItems, columnBaseRanks } = buildV2Grid(columnOpts)
  // A sort must not outlive its column: a money-axis or view toggle can drop the sorted column and its
  // SortHeader — the only control that clears the sort — freezing the rows in an unexplained order with
  // the row actions disabled (EX-486). Cleared as real state, not derived, so it doesn't resurrect if
  // the column returns (owner, 2026-07-17). setState during render is React's sanctioned path here: the
  // condition bails the loop and the discarded render rebuilds the same sort-independent columns.
  const renderedFieldIds = new Set(
    columns.map((c) => c.id).filter((id): id is string => id != null),
  )
  if (reconcileSort(sort, renderedFieldIds) !== sort) setSort(null)

  // On the owner's grid this is the FULL dataset in display order, which is what makes a filter visible:
  // figures and numbering skip the rows it hid. The client's document is not a filtered view of ours —
  // it IS the offer, so under preview the stored hide decision applies first. Search and sort are out of
  // both: a number that moved as the reader typed would name a different pozycja every keystroke.
  const documentRows = useMemo(
    () =>
      preview
        ? applyRowConditions(rows, engagedConditionIds, {
            stages,
            hasSettledMaterial,
            divergentPriceRowIds: divergentPriceIds,
            qtyDoneByRowId,
            catalogueRowIds,
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
      catalogueRowIds,
    ],
  )

  // Off `documentRows`, not `rows`, so „WC (52 poz.)" can't stand over the four pozycje a client
  // receives. No money moves with it — the rows a client's document drops are empty on both axes.
  const subtotals = useMemo(
    () => sectionSubtotalsForView(documentRows, stages, view),
    [documentRows, stages, view],
  )
  // The ids each „Sekcje …" row ticks as a block. „Wszystkie co do jednej", never „suma = 0": a section
  // fully executed but unpriced sums to zero and is exactly the one nobody wants folded away. A mixed
  // section stays visible under both halves of a pair, since „sekcje bez przedmiaru" cannot honestly
  // name a section that has some. Empty under preview — the „Filtry" menu lives in the owner's toolbar.
  const foldableSectionIds = useMemo(() => {
    if (preview) return new Map<string, Set<number>>()
    const ctx = {
      stages,
      hasSettledMaterial,
      divergentPriceRowIds: divergentPriceIds,
      qtyDoneByRowId,
      catalogueRowIds,
    }
    return new Map(
      // Skipping a non-lifting condition saves a full pass per row for a `Map` entry the menu never reads,
      // and this recomputes on every edit. A missing id falls back to an empty set, rendering no row.
      ROW_CONDITIONS.filter(liftsToSections).map((condition) => [
        condition.id,
        sectionIdsWhereAllMatch(rows, condition.id, ctx),
      ]),
    )
  }, [
    preview,
    rows,
    stages,
    hasSettledMaterial,
    divergentPriceIds,
    qtyDoneByRowId,
    catalogueRowIds,
  ])

  // Problems only: the latch's other half („Odśwież — ukryj poprawione") renders only while a problem is
  // engaged, so latching under a „Prace" filter would hold rows with no way to release them. Out under
  // preview for a different reason — nothing is being fixed in a client's document.
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
      catalogueRowIds,
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
    catalogueRowIds,
    latch,
  ])
  const ordinalByRowId = useMemo(() => baseOrdinals(documentRows), [documentRows])
  // Sections keep their original order however the filter thinned them.
  const sectionRows = useMemo(() => sectionRepresentatives(rows), [rows])
  // The money the totals bar shows and the base the global discount comes off. Full-dataset, so a search
  // or section filter can't move it.
  const totalNet = useMemo(() => subtotals.reduce((s, x) => s + x.net, 0), [subtotals])
  // What the global discount seeds itself from when „Kwotowy" is picked, so the switch replaces without
  // moving the total (EX-605). Reads 0 once the global discount is active, which is why the seed is only
  // taken on the null→'amount' transition. Rounded, not raw: each rabat is a percent of a gross, so
  // summing hundreds surfaces error around the 11th digit and this is typed into the kwota field as text.
  const perItemDiscountTotal = useMemo(
    () => roundToCents(subtotals.reduce((s, x) => s + x.discount, 0)),
    [subtotals],
  )
  // What a percent bulk-overwrite would destroy. Counted off the rows, not `subtotals`, whose discount
  // is 0 under the global discount and in the subcontractor views while the stored rabaty still exist.
  const itemsWithDiscountCount = useMemo(
    () => rows.filter((r) => r.discountValue > 0).length,
    [rows],
  )
  // Full-dataset like the subtotals, so Σ over stages equals totalNet and the etap totals reconcile
  // with the wykonane readout by construction.
  const stageTotals = useMemo(() => stageAxisForView(rows, stages, view).net, [rows, stages, view])
  // Full-dataset, so a search never moves the two synthetic totals rows.
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
  // A PROGRESS figure, not money — it must read the same in every price view, so executed/offered are
  // weighted at the client price, never the active `view`.
  const progressSubtotals = useMemo(
    () => sectionSubtotalsForView(rows, stages, 'client'),
    [rows, stages],
  )
  // doneNet feeds the progress counter; the robocizna/rabat pair routes through the shared helper the
  // investment page also calls, so the two verification surfaces can't drift. All three are client-view
  // and view-independent — neither figure may move with the price-view toggle.
  const { doneNet, laborCostsNetFromKosztorys, discountNetFromKosztorys, globalDiscountNet } =
    useMemo(
      () => clientTotalsFromSubtotals(progressSubtotals, globalDiscount),
      [progressSubtotals, globalDiscount],
    )
  const plannedNet = useMemo(
    () => progressSubtotals.reduce((s, x) => s + x.plannedNet, 0),
    [progressSubtotals],
  )

  // NOT the „Do zapłaty" the UI shows (that adds materiały and subtracts wpłaty). Robocizna alone, after
  // rabat. Both total surfaces read this one prop, so they can never disagree.
  const laborCostsNet = doneNet - globalDiscountNet

  // Roll an optimistic field edit back when the server rejects it. The „current === attempted" guard
  // lives in revertField, so a newer edit isn't stomped.
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

  // Apply one direction of a captured batch (undo → `before`, redo → `after`). Unlike an autosave this
  // is deliberate, so it writes immediately and updates `rows` + `prevById` in lockstep to stop the next
  // onChange diff re-firing the write. Each inverse goes through `runNow`, which serializes it behind
  // any in-flight forward save (EX-526 #1) and routes failure through the same toast + rollback (#3).
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
    // On failure roll the optimistic apply back via `revertOne` — the trailing `router.refresh()` can't,
    // since `rows` is the mount-frozen useState seed (EX-441), so without this a rejected inverse leaves
    // the grid diverged from the DB behind a toast.
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

  // The inverse of „w górę" is „w dół", so undo and redo are one call with the direction flipped. No
  // prevById touch (display_order isn't diffed) and no totals refresh (a reorder moves no figure).
  // The neighbour is re-derived rather than replayed from the one captured at push time: the server
  // exchanges with whatever is rank-adjacent NOW, so a stale id diverges the moment a row lands between
  // the pair. A refusal must put the pair back, or the grid shows an order no reload can reproduce.
  // `command` is the entry the gesture pushed — rolling rows back without retracting it would leave the
  // stack claiming a swap that never happened, and Cmd+Z would then overshoot by one slot (EX-737).
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

  // The tree-level half (VAT, coefficients, stage axis) is identical at every insert point, so the three
  // callers spell out only what differs: which row, in which section.
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

  // Inserts a blank row at the anchor's display slot ±1 within its section. „Above/below" means nothing
  // against a price-sorted view, so it no-ops while a column sort is active.
  async function handleInsertItem(anchorRow: KosztorysV2RowT, dir: 'above' | 'below') {
    if (!orderCommandsEnabled(sort)) return
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
    // Against the full dataset, not the view, so a filtered grid can't make a row look like its section's last.
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
    // Flush first, then drop every stack command touching the deleted row — undoing one would write
    // against a dead id, and `setStageProgressAction` (an absolute upsert) could recreate an orphan (EX-526 #2).
    flushUndoBuffer()
    pruneByIds([row.id])
    const res = await removeItemAction(row.id)
    if (!res.success) {
      // Server rejected: restore the row after the neighbour it followed, resolved against the current rows
      // so a concurrent edit during the await can't misplace it. The pruned undo history stays gone.
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
    // Built before the write so a refusal can retract exactly this entry; pushed after it, since the push
    // is synchronous and the rejection lands a tick later.
    const command: UndoCommandT = {
      label: 'Zmiana kolejności',
      undo: () => runReorderReversal(row.id, back),
      redo: () => runReorderReversal(row.id, dir),
      touchedIds: [row.id, neighbor.id],
    }
    // The server exchanges just the two display_orders — renumbering the whole section choked at 1000+
    // rows. Fired from the handler, not the setRows updater, where revalidation would move the Router.
    void persistItemSwap(row.id, dir, command)
    pushCommand(command)
  }

  // The active sort is only a view; this is what makes it survive a reload. Computed from `rows`, never
  // `viewRows` — a search would otherwise renumber the visible rows and interleave the hidden ones.
  // One server call for the whole sheet, so a half-applied bake can't renumber some sections only.
  // `revertTo` is the fallback when one stale id rejects the entire write.
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

  // The DB exchanges the two sections' display_order (2 updates, not a renumbering). Returns false at
  // the edge so no undo command is pushed for a no-op.
  function applySectionSwap(sectionId: number, dir: 'up' | 'down', command?: UndoCommandT) {
    if (neighborSectionId(rowsRef.current, sectionId, dir) == null) return false
    setRows((rs) => swapSectionBlock(rs, sectionId, dir))
    void persistSectionSwap(sectionId, dir, command)
    return true
  }

  function handleReorderSection(sectionId: number, dir: 'up' | 'down') {
    // „w górę/w dół" has no meaning against a sorted view (the band's menu also disables it).
    if (!orderCommandsEnabled(sort)) return
    // Captured BEFORE the swap: deleting the section later prunes this command, so an undo can never
    // re-derive a neighbour from rows the section no longer has.
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

  // The section's fields are still the defaults the action just wrote, so they come from
  // DEFAULT_SECTION_NAME rather than a round trip.
  function buildNewSectionRow(sectionId: number, item: { id: number; displayOrder: number }) {
    return makeBlankRow({
      id: item.id,
      displayOrder: item.displayOrder,
      sectionId,
      sectionName: DEFAULT_SECTION_NAME,
      sectionColor: null,
    })
  }

  // A new section plus its first blank item (a 0-item section renders as 0 rows) lands beside the
  // anchor section instead of at the end.
  async function handleInsertSection(anchorSectionId: number, dir: 'above' | 'below') {
    if (!orderCommandsEnabled(sort)) return
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
    setRows((rs) => [row, ...rs])
  }

  // Built through treeToRows with the CURRENT stages + global discount, so server-committed rows carry
  // today's stage columns and rabat flag. Real ids, so there is no temp-id reconciliation.
  function rowsFromSections(sections: KosztorysTreeT['sections']) {
    const built = treeToRows({
      sections,
      stages,
      progress: [],
      globalCoeffs: tree.globalCoeffs,
      vatRate: tree.vatRate,
      settlementMode: tree.settlementMode,
      materialsNetRate: tree.materialsNetRate,
      globalDiscount,
      revision: tree.revision,
    })
    for (const row of built) prevById.current.set(row.id, row)
    return built
  }

  // router.refresh() alone can't add them (mount-frozen `rows`, EX-441).
  function handleAppendedSections(slice: KosztorysTreeT['sections']) {
    const appended = rowsFromSections(slice)
    setRows((rs) => [...rs, ...appended])
    router.refresh()
  }

  // A sekcja the picker just minted lands at the TOP as one band, the way addSectionAction places one.
  // Folding in order is what keeps the katalog's selection order.
  function handleAppendedCatalogueItems(
    slice: KosztorysTreeT['sections'][number],
    createdSection: boolean,
  ) {
    const placement = catalogueSlicePlacement(rowsRef.current, slice.id, createdSection)
    if (placement === 'reseed') return recoverStaleTree()
    const appended = rowsFromSections([slice])
    setRows((rs) =>
      placement === 'prepend' ? [...appended, ...rs] : appended.reduce(applyAddItem, rs),
    )
    unfoldSection(slice.id)
    router.refresh()
  }

  async function handleRemoveSection(sectionId: number) {
    // The summary confirms first (EX-477); a populated section cascade-deletes its items + stage_progress
    // server-side, guarded by that confirm, not a block.
    const removed = rowsRef.current
      .filter((r) => r.sectionId === sectionId)
      .map((r) => prevById.current.get(r.id) ?? r)
    setRows((rs) => rs.filter((r) => r.sectionId !== sectionId))
    // The section's band and footer have handles of their own.
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
    // collapsedSectionIds is left alone: with no rows there is no band to fold, so a leftover id is inert
    // — and it keeps the fold state if the server rejects and the rows come back.
    const res = await removeSectionAction(sectionId)
    if (!res.success) {
      // Server rejected (predicate drift) — restore the section's rows and surface the block.
      for (const r of removed) prevById.current.set(r.id, r)
      setRows((rs) => [...rs, ...removed])
      reportFailure(res.error, res.code)
    }
  }

  // Denormalized on every row of the section, so setting one patches them all and persists once.
  const SECTION_ROW_FIELDS = { sectionName: 'name', sectionColor: 'color' } as const
  type SectionRowFieldT = keyof typeof SECTION_ROW_FIELDS

  // Extracted so undo/redo can re-run it with the before/after value. The forward write debounces on the
  // field's lane: the colour picker stays open for repeated picking, so browsing the palette is a burst
  // and each pick would otherwise cost a round trip plus an UPDATE. `immediate` is what undo/redo pass,
  // pre-empting a still-pending forward save instead of racing it (EX-526 #1).
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
    // No revert-on-error: a section's colour and name are cosmetic, so the lane's toast is enough —
    // yanking the swatch back mid-browse costs more than the stale tint.
    const persist = immediate ? runNow : save
    persist(`section-field:${sectionId}:${rowKey}`, () =>
      updateSectionFieldAction(sectionId, { [SECTION_ROW_FIELDS[rowKey]]: value }),
    )
  }

  // The Sekcja cell's onBlur fires on every focus-out and the colour picker stays open across clicks,
  // so both can re-send a value they already hold.
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

  /**
   * „Aktualizuj kosztorys" from the katalog window: the ticked liczby are pulled out of the cennik
   * and written onto the rozpiska in one go.
   *
   * Patched from what the ACTION returns rather than optimistically — unlike the rabat bulk-apply,
   * the client does not know the values it is asking for. They are read from the cennik server-side
   * (that is what stops a tampered payload pricing a praca), so there is nothing to show until the
   * write answers, and nothing to revert if it doesn't.
   *
   * `patchRows`, never a refresh: `rows` is a mount-frozen seed, and `catalogueComparison` is a memo
   * over `rows`, so the report and the „Problemy" counters shrink in the same render — the window
   * stays open and the sort and filters the owner set to find these prace survive.
   */
  async function handleApplyCatalogueToItems(
    selections: { itemId: number; fields: SeedConflictFieldT[] }[],
  ): Promise<boolean> {
    let res
    try {
      res = await applyCatalogueToKosztorysAction(investmentId, selections)
    } catch {
      // A transport-level failure throws client-side, bypassing the result contract — without this
      // the whole editor hits its error boundary over one failed bulk write.
      toastMessage('Nie udało się zaktualizować kosztorysu', 'warning', 4000)
      return false
    }
    if (!res.success) {
      toastMessage(res.error, 'warning', 4000)
      return false
    }
    const patchById = new Map(res.data.map(({ itemId, ...values }) => [itemId, values] as const))
    patchRows(
      (r) => patchById.has(r.id),
      (r) => ({ ...r, ...patchById.get(r.id) }),
    )
    return true
  }

  /**
   * Accepting a „może chodzi o…" candidate: the praca takes the cennik's opis AND j.m.
   *
   * Both or neither — the klucz is the pair, so writing the nazwa alone moves the praca from one
   * „brak w katalogu" to another and the gesture looks like it did nothing. Prices are deliberately
   * untouched: this settles what the praca is CALLED, and what it costs is the next, separate
   * decision — the one the „Inne liczby" block it now lands in is for.
   */
  async function handleAcceptCatalogueName(
    itemId: number,
    name: { description: string; unit: string },
  ): Promise<boolean> {
    const before = rowsRef.current.find((r) => r.id === itemId)
    patchRows(
      (r) => r.id === itemId,
      (r) => ({ ...r, description: name.description, unit: name.unit }),
    )
    const res = await updateItemFieldAction(itemId, name)
    if (!res.success) {
      if (before)
        patchRows(
          (r) => r.id === itemId,
          (r) => ({ ...r, description: before.description, unit: before.unit }),
        )
      toastMessage(res.error, 'warning', 4000)
      return false
    }
    return true
  }

  // The markup coefficients are denormalized on every row but changed OUTSIDE the grid, and
  // router.refresh() won't pick them up — `rows` is a mount-frozen useState seed, so without this patch
  // the „Cena" column shows the stale value until a reload.
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
    // A zakończona inwestycja is already stopped by `disabled: true` on every column, but a preview grid
    // is served to an anonymous visitor — belt as well as braces.
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
    // Advance over the array the grid handed us rather than a per-keystroke copy. Rows absent from the
    // snapshot stay absent — the same „never seen, nothing to diff" skip planGridChanges applies.
    for (const row of next) if (prevById.current.has(row.id)) prevById.current.set(row.id, row)
    // One onChange batch (incl. a multi-cell paste) becomes one composite undo entry.
    if (fieldChanges.length > 0 || stageChanges.length > 0) {
      pendingFields.current.push(...fieldChanges)
      pendingStages.current.push(...stageChanges)
      setHasPendingBurst(true)
      if (flushTimer.current) clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(flushUndoBuffer, UNDO_COALESCE_MS)
    }
    if (changedById.size > 0) {
      // Merge by id so filter/sort don't lose hidden rows.
      setRows((master) => master.map((r) => changedById.get(r.id) ?? r))
      // Only when something changed — an unconditional refresh on a spurious onChange could loop the render.
      // Restarting the timer is what makes „quiets down" true: unclamped, a run of edited cells queues one
      // full-route refresh each.
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => router.refresh(), TOTALS_REFRESH_DEBOUNCE_MS)
    }
  }

  return {
    // „Wybierz pozycję z katalogu prac" reads this to tell which cennik prace are already in; viewRows
    // would answer for the active filter instead.
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
    fitRowsToContent,
    toggleFitRowsToContent,
    // Composed in the body: fitting a row to its text needs the measured column widths, which only the
    // rendered grid knows.
    setRowHeight,
    setGuideY,
    collapsedSectionIds,
    storedCollapsedSectionIds,
    toggleSectionCollapsed,
    setCollapsedSectionIds,
    // Reused from columnOpts so no two surfaces can disagree about whether editing is allowed.
    onRenameSection: columnOpts.onRenameSection,
    onInsertSection: columnOpts.onInsertSection,
    onReorderSection: columnOpts.onReorderSection,
    onSetSectionColor: columnOpts.onSetSectionColor,
    onRemoveSection: columnOpts.onRemoveSection,
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
    // The one comparison against the cennik: the „Problemy" counters and the „Porównaj z katalogiem
    // prac" window both read it, so the two can never show different numbers. `null` = no cennik on
    // this surface.
    catalogueComparison,
    // The cennik itself, for the one thing the comparison deliberately leaves out: the „może chodzi
    // o…" guesses, which are O(pozycje × katalog) and so belong to the opened window, not to a memo
    // that runs on every keystroke.
    workCatalogue,
    laborCostsNet,
    // toolbar / panel state
    setView,
    search,
    setSearch,
    engagedConditionIds,
    engagedStageConditionIds,
    showAllRows,
    setShowAllRows,
    clientEmptyRowIds,
    toggleCondition,
    setConditions,
    toggleConditionExclusive,
    refreshProblemRows,
    resetFilters,
    conditionCounts,
    foldableSectionIds,
    ordinalByRowId,
    sectionRows,
    moveEdges,
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
    handleApplyCatalogueToItems,
    handleAcceptCatalogueName,
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
