'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Column } from 'react-datasheet-grid'
import { useDebouncedSave } from '@/components/kosztorys/editor/hooks/use-debounced-save'
import { useStaleTreeRecovery } from '@/components/kosztorys/editor/hooks/use-stale-tree-recovery'
import { useExternalChangeReload } from '@/components/kosztorys/editor/hooks/use-external-change-reload'
import { useWorkerReportAcceptance } from '@/components/kosztorys/editor/hooks/use-worker-report-acceptance'
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
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'
import type { WorkerAudienceT } from '@/lib/kosztorys/worker-view/types'
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
import { useCrewAxis } from '@/components/kosztorys/editor/hooks/use-crew-axis'
import { effectiveCrewAxis } from '@/lib/kosztorys/crew-axis'
import { useMoneyAxis } from '@/components/kosztorys/editor/hooks/use-money-axis'
import { effectiveMoneyAxis } from '@/lib/kosztorys/money-axis'
import { useElementHeight } from '@/hooks/use-element-height'
import { buildV2Grid } from '@/components/kosztorys/editor/grid/kosztorys-v2-columns'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import {
  applyAddItem,
  applyInsertItem,
  applyRemoveItem,
  applyRestoreItem,
  applyKosztorysOrder,
  catalogueSlicePlacement,
  groupBySection,
  revertField,
  sectionNeighbor,
  swapItemInSection,
} from '@/lib/kosztorys/row-ops'
import { columnTotalsForRows } from '@/lib/kosztorys/columns/column-totals'
import { sectionSubtotalsForView, stageAxisForView } from '@/lib/kosztorys/settlement-aggregates'
import { clientTotalsFromSubtotals } from '@/lib/kosztorys/settlement-client-totals'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import { marginForecastByPlane as forecastByPlane } from '@/lib/kosztorys/margin-forecast'
import { divergentPriceRowIds } from '@/lib/kosztorys/price-divergence'
import { qtyDoneByRow } from '@/lib/kosztorys/row-conditions/ctx'
import type { RowConditionCtxT } from '@/lib/kosztorys/row-conditions/types'
import { buildViewRows } from '@/lib/kosztorys/row-view'
import { computeMoveEdges } from '@/lib/kosztorys/move-edges'
import { orderCommandsEnabled } from '@/lib/kosztorys/order-commands'
import {
  applyRowConditions,
  clientConditionIds,
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
import { emptySettlementColumnIds } from '@/lib/kosztorys/settlement-columns'
import { workerDataHiddenColumns } from '@/lib/kosztorys/worker-view/columns'
import { baseOrdinals } from '@/lib/kosztorys/section-band-rows'
import { reconcileSort, sortValueGetter } from '@/lib/kosztorys/columns/sort-value'
import { planKosztorysRenumber } from '@/lib/kosztorys/display-order-plan'
import type { InvestmentLockT } from '@/lib/constants/investment-lock'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import {
  insertSection,
  orderRowsBySections,
  patchSection,
  removeSection,
  restoreSection,
  swapSection,
  treeToSections,
} from '@/lib/kosztorys/section-list'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { sectionFooterRowId, sectionHeaderRowId } from '@/lib/kosztorys/synthetic-rows'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { settleAction } from '@/lib/utils/settle-action'
import {
  addSectionAction,
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
import { applyCatalogueToKosztorysAction } from '@/lib/actions/catalogue-to-kosztorys'
import { buildCatalogueComparison } from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import type {
  ItemPatchT,
  KosztorysItemT,
  KosztorysStageT,
  KosztorysTreeT,
  KosztorysV2RowT,
  NewItemPlacementT,
  SectionMetaT,
} from '@/lib/kosztorys/types'
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
  worker?: WorkerAudienceT
  // „Zakończona" or in the trash — the server refuses every write. Kept apart from `preview`: the two
  // agree on interaction and disagree on disclosure, and a locked investment is still the owner's OWN
  // document.
  lock?: InvestmentLockT
  undoRedo: UndoRedoApiT
  // Absent on the client share path, which renders no menu.
  workers?: WorkerRefT[]
  // Gate on the overpaid-crew problem (EX-708). Defaults false for client-share, which counts none.
  hasSettledMaterial?: boolean
  // The whole cennik, for the two katalog problems. Absent on the podglądy, where its absence is
  // what switches both rows off — an empty array would mean „nothing is in the cennik".
  workCatalogue?: WorkCatalogueItemT[]
  // Reseed-the-whole-tree path for a write that returns NOT_FOUND. Absent on the read-only body.
  onStaleTree?: () => Promise<unknown>
  // The szablon workbench — the grid narrows to what a szablon carries.
  isTemplate?: boolean
  // A past version's grid: etapy the present has filled, so their columns stay on screen.
  filledStageIds?: ReadonlySet<number>
  // Only ever with `preview`.
  seams?: PreviewSeamsT
}

// What a read-only document with one input column of its own supplies — the worker's report form.
export type PreviewSeamsT = {
  transformColumns: (columns: Column<KosztorysV2RowT>[]) => Column<KosztorysV2RowT>[]
  initialRowPatch: (rows: KosztorysV2RowT[]) => KosztorysV2RowT[]
  onPreviewChange: (stageChanges: StageChangeT[]) => void
}

// Longer than the debounced save (500ms) so a burst is captured only once its writes are scheduled.
const UNDO_COALESCE_MS = 700

const NO_ROW_IDS: ReadonlySet<number> = new Set()

// Handlers never fire an action from inside a setRows updater — that would move the Router during
// render.
export function useKosztorysEditor({
  investmentId,
  tree,
  preview = false,
  clientView,
  worker,
  lock,
  undoRedo,
  workers,
  hasSettledMaterial = false,
  workCatalogue,
  onStaleTree,
  isTemplate = false,
  filledStageIds,
  seams,
}: ArgsT) {
  // Interaction, split from disclosure: `preview` decides what a client is SHOWN, this decides whether
  // anything may be written.
  const readOnly = preview || lock !== undefined
  const { recoverStaleTree, reportFailure } = useStaleTreeRecovery(onStaleTree)
  const { save, runNow, drain } = useDebouncedSave(500, recoverStaleTree)
  // Owned by the shell (KosztorysEditorV2). Capture pushes here; toolbar + keyboard call undo/redo.
  const { push, undo, redo, canUndo, canRedo, pruneByIds, amendTop } = undoRedo
  const [gridRef, gridHeight, gridNode] = useElementHeight()
  // The row store looks like the obvious fourth extraction after settlement/stage-ops/view-state and
  // isn't (EX-702): those had narrow seams, this has ~47 references across ~30 handlers, so pulling it
  // out leaves every call site reaching in — the indirection on the hot path EX-496 was reverted over.
  // Settle EX-422 first: if rowsRef/prevById stop being load-bearing, what's left to extract is smaller.
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() =>
    seams ? seams.initialRowPatch(treeToRows(tree)) : treeToRows(tree),
  )
  // The only place a section without pozycje exists. `rows` stays laid out as contiguous blocks in
  // this order.
  const [sections, setSections] = useState<SectionMetaT[]>(() => treeToSections(tree))
  const documentSettings = worker?.settings ?? clientView
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
  } = useKosztorysViewState({
    investmentId,
    preview,
    clientView: documentSettings,
    workerPlane: worker?.plane,
    isTemplate,
  })

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
  const [storedCrewAxis, setCrewAxis] = useCrewAxis()
  const crewAxis = effectiveCrewAxis(view, storedCrewAxis)
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
  const sectionsRef = useRef(sections)
  // eslint-disable-next-line react-hooks/refs
  sectionsRef.current = sections
  // Filled by `NewItemHost`. A ref, not state: opening the dialog must not re-render the grid (EX-496).
  const newItemDialogRef = useRef<((placement: NewItemPlacementT) => void) | null>(null)

  const {
    stages,
    adoptStage,
    handleAddStage,
    handleRemoveStage,
    handleRenameStage,
    handleSetStagePlane,
    handleSetStageSplit,
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

  // A restore remounts the body: drop a dangling flush so it can't close over the outgoing mount's
  // setRows.
  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
    }
  }, [])

  // Flush any buffering grid edit first, so a burst typed just before keeps its LIFO place on the stack.
  function pushCommand(cmd: Parameters<typeof push>[0]) {
    flushUndoBuffer()
    push(cmd)
  }

  // Direction is expressed by which argument is replayed, so undo and redo share one function.
  function pushReversible<T>(
    label: string,
    apply: (state: T) => void,
    before: T,
    after: T,
    touchedIds?: number[],
  ) {
    pushCommand({ label, undo: () => apply(before), redo: () => apply(after), touchedIds })
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
  const conditionCtx = useMemo<RowConditionCtxT>(
    () => ({
      stages,
      hasSettledMaterial,
      divergentPriceRowIds: divergentPriceIds,
      qtyDoneByRowId,
      catalogueRowIds,
    }),
    [stages, hasSettledMaterial, divergentPriceIds, qtyDoneByRowId, catalogueRowIds],
  )

  // Counted over the whole dataset: once a filter is on, a count of what survives it is a count of
  // itself and can never reach zero to say the problem is gone.
  // The two halves are counted separately because only the stage half depends on the view and the row
  // half is the expensive one — counted together, switching the plane re-ran all of them for the same numbers.
  const rowConditionCounts = useMemo(
    () =>
      ROW_CONDITIONS.map(
        (condition) =>
          [condition.id, preview ? 0 : countMatching(rows, condition.id, conditionCtx)] as const,
      ),
    [preview, rows, conditionCtx],
  )
  // What the owner's „Ukryj pozycje…" takes out of the client's document: its size labels the
  // investor's „Pokaż wszystkie pozycje", and its members render muted once they are shown. Asked
  // even while the switch is on — the rule is what the owner stored, not what is currently hidden.
  const clientEmptyRowIds = useMemo(
    () =>
      preview
        ? rowIdsMatching(rows, clientConditionIds(documentSettings?.hideEmptyRows), conditionCtx)
        : NO_ROW_IDS,
    [preview, documentSettings?.hideEmptyRows, rows, conditionCtx],
  )
  // Over the view's own etapy: a subcontractor view already drops plane-less etapy, so counting the raw
  // list would offer a filter that can only empty the stage block. Asymmetric with the price conditions
  // by design — a price exists on both planes, an etap belongs to one.
  const stageConditionCounts = useMemo(() => {
    const viewStages = stagesForView(stages, view)
    return STAGE_CONDITIONS.map(
      (condition) =>
        [
          condition.id,
          preview ? 0 : countMatchingStages(viewStages, condition.id, subcontractorDue),
        ] as const,
    )
  }, [preview, stages, view, subcontractorDue])
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

  // Subtracts from the closed list, never adds to it. The worker's stored hidden set is already
  // folded into his list by `workerVisibleColumns`, so only the data's share is added for him. Off
  // `rows`, not `viewRows`, so a column does not come and go with „Pokaż wszystkie pozycje".
  const documentHiddenColumns = useMemo(() => {
    if (!preview) return undefined
    if (worker) {
      return workerDataHiddenColumns(rows, stages, worker.settings.hidePlannedOnceExecuted)
    }
    return new Set([
      ...(clientView?.hiddenColumns ?? []),
      ...emptySettlementColumnIds(rows, stages, filledStageIds),
    ])
  }, [preview, worker, clientView, rows, stages, filledStageIds])

  // Which ▲/▼ the two menus may offer at all.
  const moveEdges = useMemo(() => computeMoveEdges(rows, sections), [rows, sections])

  const onAddItem = editorOnly(handleAddItem)

  const columnOpts = {
    view,
    stages,
    onRemoveStage: editorOnly(handleRemoveStage),
    onRenameStage: editorOnly(handleRenameStage),
    onSetStagePlane: editorOnly(handleSetStagePlane),
    onSetStageSplit: editorOnly(handleSetStageSplit),
    workers,
    executedValueByStage: subcontractorDue.byStage,
    scaledDownStageIds: subcontractorDue.scaledDownStageIds,
    sort,
    onSetSort: editorOnly(setSortField),
    isHidden,
    moneyAxis: axis,
    layer,
    crewAxis,
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
    previewVisible: preview && !worker,
    documentHiddenColumns,
    previewColumnRanks: clientView?.columnRanks,
    workerSurface: worker
      ? {
          plane: worker.plane,
          hiddenColumns: worker.settings.hiddenColumns,
          columnRanks: worker.settings.columnRanks,
          executedQtyByItem: worker.executedQtyByItem,
        }
      : undefined,
    workshopVisible: isTemplate,
  }
  const grid = buildV2Grid(columnOpts)
  const { columnToggleItems, columnBaseRanks } = grid
  const columns = seams ? seams.transformColumns(grid.columns) : grid.columns
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
    () => (preview ? applyRowConditions(rows, engagedConditionIds, conditionCtx) : rows),
    [preview, rows, engagedConditionIds, conditionCtx],
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
    return new Map(
      // Skipping a non-lifting condition saves a full pass per row for a `Map` entry the menu never reads,
      // and this recomputes on every edit. A missing id falls back to an empty set, rendering no row.
      ROW_CONDITIONS.filter(liftsToSections).map((condition) => [
        condition.id,
        sectionIdsWhereAllMatch(rows, condition.id, conditionCtx),
      ]),
    )
  }, [preview, rows, conditionCtx])

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
      ...conditionCtx,
      latchedRowIds: latch?.ids,
    })
    if (latch) for (const row of next) latch.ids.add(row.id)
    return next
  }, [rows, search, engagedConditionIds, sort, view, conditionCtx, latch])
  const ordinalByRowId = useMemo(() => baseOrdinals(documentRows), [documentRows])
  // A band with nothing under it would read as „this section has no hits" under a search or filter,
  // and a client's document has no use for an empty chapter.
  // Recognised ids only: a persisted id from a since-removed condition narrows nothing and shows no
  // chip, so counting it would hide every itemless band with no way for the owner to get them back.
  const showItemless =
    !preview &&
    search.trim() === '' &&
    !ROW_CONDITIONS.some((condition) => engagedConditionIds.has(condition.id))
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
    () => columnTotalsForRows(rows, stages, view, tree.vatRate, worker?.executedQtyByItem),
    [rows, stages, view, tree.vatRate, worker?.executedQtyByItem],
  )
  const sectionColumnTotals = useMemo(
    () =>
      new Map(
        [...groupBySection(rows)].map(([sectionId, rowsOfSection]) => [
          sectionId,
          columnTotalsForRows(rowsOfSection, stages, view, tree.vatRate, worker?.executedQtyByItem),
        ]),
      ),
    [rows, stages, view, tree.vatRate, worker?.executedQtyByItem],
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
    // On failure roll the optimistic apply back via `revertOne` — `rows` is the mount-frozen useState
    // seed (EX-441), so no render can, and a rejected inverse would leave the grid diverged from the DB.
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
  }

  // The inverse of „w górę" is „w dół", so undo and redo are one call with the direction flipped. No
  // prevById touch (display_order isn't diffed).
  // The neighbour is re-derived rather than replayed from the one captured at push time: the server
  // exchanges with whatever is rank-adjacent NOW, so a stale id diverges the moment a row lands between
  // the pair. A refusal must put the pair back, or the grid shows an order no reload can reproduce.
  // `command` is the entry the gesture pushed — rolling rows back without retracting it would leave the
  // stack claiming a swap that never happened, and Cmd+Z would then overshoot by one slot (EX-737).
  // `amendTop` is identity-guarded, so anything the user did since makes this a silent no-op.
  async function persistItemSwap(itemId: number, dir: 'up' | 'down', command?: UndoCommandT) {
    const res = await settleAction(() => swapItemOrderAction(itemId, dir))
    if (res.success) return
    setRows((rs) => swapItemInSection(rs, itemId, dir === 'up' ? 'down' : 'up'))
    if (command) amendTop(command, null)
    reportFailure(res.error, res.code)
  }

  function runReorderReversal(itemId: number, dir: 'up' | 'down') {
    setRows((rs) => swapItemInSection(rs, itemId, dir))
    void persistItemSwap(itemId, dir)
  }

  // Latest-value write alongside the state, so a second section gesture before the next render reads
  // the list the first one produced.
  function commitSections(next: SectionMetaT[]) {
    sectionsRef.current = next
    setSections(next)
  }

  function sectionMeta(sectionId: number) {
    return sectionsRef.current.find((section) => section.sectionId === sectionId)
  }

  // „Nowa praca" is a form (EX-951), so both entry points only choose where the praca goes; the host
  // owns the dialog and hands the saved praca back through `placeNewItem`.
  function handleAddItem(sectionId: number) {
    newItemDialogRef.current?.({ kind: 'end', sectionId })
  }

  // „Above/below" means nothing against a price-sorted view, so it no-ops while a column sort is active.
  function handleInsertItem(anchorRow: KosztorysV2RowT, dir: 'above' | 'below') {
    if (!orderCommandsEnabled(sort)) return
    newItemDialogRef.current?.({ kind: 'next-to', anchorItemId: anchorRow.id, dir })
  }

  function placeNewItem(item: KosztorysItemT, placement: NewItemPlacementT) {
    const meta = sectionMeta(item.sectionId)
    const [row] = rowsFromSections([
      {
        id: item.sectionId,
        name: meta?.sectionName ?? DEFAULT_SECTION_NAME,
        displayOrder: 0,
        color: meta?.sectionColor ?? null,
        items: [item],
      },
    ])
    if (placement.kind === 'next-to') {
      setRows((rs) => applyInsertItem(rs, placement.anchorItemId, row, placement.dir))
    } else {
      // A section's first pozycja has no row to follow, so applyAddItem appends it past every other
      // block; the re-lay puts it back under its own band. Asked of the updater's rows, not rowsRef:
      // a delete of the section's last pozycja can land while the dialog is open.
      const order = sectionsRef.current
      setRows((rs) => {
        const next = applyAddItem(rs, row)
        return rs.some((r) => r.sectionId === item.sectionId)
          ? next
          : orderRowsBySections(next, order)
      })
    }
    unfoldSection(item.sectionId)
  }

  async function handleRemoveItem(row: KosztorysV2RowT) {
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
    const res = await settleAction(() => removeItemAction(row.id))
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
    const res = await settleAction(() => renumberKosztorysOrderAction(investmentId, next))
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
      sortValueGetter(sort.field, view, stages),
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
    const res = await settleAction(() => swapSectionOrderAction(sectionId, dir))
    if (res.success) return
    const back = swapSection(sectionsRef.current, sectionId, dir === 'up' ? 'down' : 'up')
    if (back) applySectionOrder(back)
    if (command) amendTop(command, null)
    reportFailure(res.error, res.code)
  }

  function applySectionOrder(next: SectionMetaT[]) {
    commitSections(next)
    setRows((rs) => orderRowsBySections(rs, next))
  }

  // The DB exchanges the two sections' display_order (2 updates, not a renumbering). Returns false at
  // the edge so no undo command is pushed for a no-op.
  function applySectionSwap(sectionId: number, dir: 'up' | 'down', command?: UndoCommandT) {
    const next = swapSection(sectionsRef.current, sectionId, dir)
    if (!next) return false
    applySectionOrder(next)
    void persistSectionSwap(sectionId, dir, command)
    return true
  }

  function handleReorderSection(sectionId: number, dir: 'up' | 'down') {
    // „w górę/w dół" has no meaning against a sorted view (the band's menu also disables it).
    if (!orderCommandsEnabled(sort)) return
    // The header id is what lets deleting the section prune this command even when it has no rows.
    const touchedIds = [
      sectionHeaderRowId(sectionId),
      ...rowsRef.current.filter((r) => r.sectionId === sectionId).map((r) => r.id),
    ]
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
  function newSectionMeta(sectionId: number): SectionMetaT {
    return { sectionId, sectionName: DEFAULT_SECTION_NAME, sectionColor: null }
  }

  async function handleInsertSection(anchorSectionId: number, dir: 'above' | 'below') {
    if (!orderCommandsEnabled(sort)) return
    const res = await settleAction(() => insertSectionAction(anchorSectionId, dir))
    if (!res.success) return reportFailure(res.error, res.code)
    const meta = newSectionMeta(res.data.section.id)
    commitSections(insertSection(sectionsRef.current, meta, anchorSectionId, dir))
  }

  // Resolves to the new section's id, so „Dodaj → Praca" on an empty kosztorys can put a pozycja in it.
  async function handleAddSection(): Promise<number | undefined> {
    const res = await settleAction(() => addSectionAction(investmentId))
    if (!res.success) {
      reportFailure(res.error, res.code)
      return undefined
    }
    const meta = newSectionMeta(res.data.section.id)
    commitSections(insertSection(sectionsRef.current, meta, null))
    return meta.sectionId
  }

  // Built through treeToRows with the CURRENT stages + global discount, so server-committed rows carry
  // today's stage columns and rabat flag. Real ids, so there is no temp-id reconciliation.
  function rowsFromSections(
    treeSections: KosztorysTreeT['sections'],
    newStages: KosztorysStageT[] = [],
  ) {
    const built = treeToRows({
      sections: treeSections,
      stages: [...stages, ...newStages],
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

  // New rows reach the grid only through this local patch, never through a render (mount-frozen
  // `rows`, EX-441).
  function handleAppendedSections(slice: KosztorysTreeT['sections']) {
    const appended = rowsFromSections(slice)
    commitSections([...sectionsRef.current, ...treeToSections({ sections: slice })])
    setRows((rs) => [...rs, ...appended])
  }

  // A sekcja the picker just minted lands at the TOP as one band, the way addSectionAction places one.
  // Folding in order is what keeps the katalog's selection order. An accepted report never mints one.
  function handleAppendedCatalogueItems(
    slice: KosztorysTreeT['sections'][number],
    createdSection: boolean,
    newStages: KosztorysStageT[] = [],
  ) {
    const placement = catalogueSlicePlacement(
      new Set(sectionsRef.current.map((section) => section.sectionId)),
      slice.id,
      createdSection,
    )
    if (placement === 'reseed') return recoverStaleTree()
    const appended = rowsFromSections([slice], newStages)
    if (placement === 'prepend') {
      const [meta] = treeToSections({ sections: [slice] })
      commitSections(insertSection(sectionsRef.current, meta, null))
      setRows((rs) => [...appended, ...rs])
    } else {
      // Folding into a sekcja bez pozycji appends past every block, so the fold re-lays.
      const order = sectionsRef.current
      setRows((rs) => orderRowsBySections(appended.reduce(applyAddItem, rs), order))
    }
    unfoldSection(slice.id)
  }

  const { adoptRevision } = useExternalChangeReload({
    investmentId,
    revision: tree.revision,
    enabled: !readOnly && onStaleTree !== undefined,
    onChanged: () => {
      toastMessage(
        'Rozpiska zmieniła się w innym oknie — wczytano aktualną wersję.',
        'warning',
        6000,
      )
      void onStaleTree?.()
    },
  })

  const { acceptReport, rejectReport } = useWorkerReportAcceptance({
    investmentId,
    flushUndoBuffer,
    drain,
    adoptStage,
    appendItems: (slice, newStages) => handleAppendedCatalogueItems(slice, false, newStages),
    patchRows,
    pruneByIds,
    adoptRevision,
    reportFailure,
  })

  async function handleRemoveSection(sectionId: number) {
    // The summary confirms first (EX-477); a populated section cascade-deletes its items + stage_progress
    // server-side, guarded by that confirm, not a block.
    const removed = rowsRef.current
      .filter((r) => r.sectionId === sectionId)
      .map((r) => prevById.current.get(r.id) ?? r)
    const meta = sectionMeta(sectionId)
    const { next, index } = removeSection(sectionsRef.current, sectionId)
    commitSections(next)
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
    // Drop stack commands touching the section or any of its cascade-deleted rows (EX-526 #2) — see
    // handleRemoveItem. The header id carries the section's own rename, recolour and reorder.
    flushUndoBuffer()
    pruneByIds([sectionHeaderRowId(sectionId), ...removed.map((r) => r.id)])
    // collapsedSectionIds is left alone: an id whose section left the list folds nothing, and it keeps
    // the fold state if the server rejects and the section comes back.
    const res = await settleAction(() => removeSectionAction(sectionId))
    if (!res.success) {
      // Server rejected (predicate drift).
      for (const r of removed) prevById.current.set(r.id, r)
      const restored = meta ? restoreSection(sectionsRef.current, meta, index) : sectionsRef.current
      commitSections(restored)
      setRows((rs) => orderRowsBySections([...rs, ...removed], restored))
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
    value: SectionMetaT[K],
    { immediate = false }: { immediate?: boolean } = {},
  ) {
    commitSections(patchSection(sectionsRef.current, sectionId, { [rowKey]: value }))
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
    value: SectionMetaT[K],
    undoLabel: string,
  ) {
    const before = sectionMeta(sectionId)?.[rowKey]
    if (before === undefined || before === value) return
    applySectionField(sectionId, rowKey, value)
    pushReversible(
      undoLabel,
      (v: SectionMetaT[K]) => applySectionField(sectionId, rowKey, v, { immediate: true }),
      before,
      value,
      [sectionHeaderRowId(sectionId)],
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
   * `patchRows`, never a refetch: `rows` is a mount-frozen seed, and `catalogueComparison` is a memo
   * over `rows`, so the report and the „Problemy" counters shrink in the same render — the window
   * stays open and the sort and filters the owner set to find these prace survive.
   */
  async function handleApplyCatalogueToItems(
    selections: { itemId: number; fields: SeedConflictFieldT[] }[],
  ): Promise<boolean> {
    const res = await settleAction(() => applyCatalogueToKosztorysAction(investmentId, selections))
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
    const res = await settleAction(() => updateItemFieldAction(itemId, name))
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
  // the action's render won't pick them up — `rows` is a mount-frozen useState seed, so without this patch
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

  // Nothing is saved: the seam's owner decides where the one editable column's figures go.
  function applyPreviewChanges(
    next: KosztorysV2RowT[],
    onPreviewChange: PreviewSeamsT['onPreviewChange'],
  ) {
    const { stageChanges, changedById } = planGridChanges(next, prevById.current)
    onPreviewChange(stageChanges)
    for (const row of next) if (prevById.current.has(row.id)) prevById.current.set(row.id, row)
    if (changedById.size > 0) setRows((master) => master.map((r) => changedById.get(r.id) ?? r))
  }

  function onChange(next: KosztorysV2RowT[]) {
    // A zakończona inwestycja is already stopped by `disabled: true` on every column, but a preview grid
    // is served to an anonymous visitor — belt as well as braces.
    if (preview) {
      if (seams) applyPreviewChanges(next, seams.onPreviewChange)
      return
    }
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
    }
  }

  return {
    // „Wybierz pozycję z katalogu prac" reads this to tell which cennik prace are already in; viewRows
    // would answer for the active filter instead.
    rows,
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
    crewAxis,
    setCrewAxis,
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
    onAddItem,
    subtotals,
    // client-priced, view-invariant per-section subtotals — the section pie's structure source.
    progressSubtotals,
    totalNet,
    columnTotals,
    sectionColumnTotals,
    stageTotals,
    stages,
    // The roster the „Pracownicy" menu names assigned workers from; empty where no menu renders.
    workers: workers ?? [],
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
    sections,
    showItemless,
    moveEdges,
    // Read by the toolbar and the summary through the editor context: on a locked investment they
    // drop their own write entries, which `editorOnly` (a grid-callback gate) never reaches.
    readOnly,
    onChange,
    handleAddItem,
    placeNewItem,
    newItemDialogRef,
    recoverStaleTree,
    handleAddSection,
    handleAppendedSections,
    handleAppendedCatalogueItems,
    handleAddStage,
    acceptReport,
    rejectReport,
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
