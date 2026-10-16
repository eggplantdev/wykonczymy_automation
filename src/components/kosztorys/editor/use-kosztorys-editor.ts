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
import { useColumnColors } from '@/components/kosztorys/editor/hooks/use-column-colors'
import { useRowHeights } from '@/components/kosztorys/editor/hooks/use-row-heights'
import { useConditionRowLatch } from '@/components/kosztorys/editor/hooks/use-condition-row-latch'
import { engagedLatchingIds, engagedStageProblemIds } from '@/lib/kosztorys/problem-conditions'
import { useKosztorysSettings } from '@/components/kosztorys/editor/hooks/use-kosztorys-settings'
import { useKosztorysStageOps } from '@/components/kosztorys/editor/hooks/use-kosztorys-stage-ops'
import { useKosztorysViewState } from '@/components/kosztorys/editor/hooks/use-kosztorys-view-state'
import { useColumnOrder } from '@/components/kosztorys/editor/hooks/use-column-order'
import { useHiddenColumns } from '@/components/kosztorys/editor/hooks/use-hidden-columns'
import { useHiddenStages } from '@/components/kosztorys/editor/hooks/use-hidden-stages'
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
import { investorEmptyColumnIds } from '@/lib/kosztorys/settlement-columns'
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
  treeToSections,
} from '@/lib/kosztorys/section-list'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { sectionFooterRowId, sectionHeaderRowId } from '@/lib/kosztorys/synthetic-rows'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { settleAction } from '@/lib/utils/settle-action'
import { setStageProgressAction } from '@/lib/actions/kosztorys'
import { useEditorActions } from '@/components/kosztorys/editor/actions/editor-actions-context'
import { applyCatalogueToKosztorysAction } from '@/lib/actions/catalogue-to-kosztorys'
import { buildCatalogueComparison } from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import { AI_REVIEW_COLUMN_IDS } from '@/lib/kosztorys/ai-review-columns'
import { applyReviewRules, hasAiDraft } from '@/lib/kosztorys/review-status'
import type {
  ItemPatchT,
  KosztorysItemT,
  KosztorysStageT,
  KosztorysTreeT,
  KosztorysV2RowT,
  NewItemPlacementT,
  SectionMetaT,
} from '@/lib/kosztorys/types'
import type {
  CatalogueNameT,
  SeedConflictFieldT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import { toastMessage } from '@/lib/utils/toast'
import { useTranslation } from '@/hooks/use-translation'
import { mergeTranslations } from '@/lib/i18n/description-translations'
import type { WorkerRefT } from '@/types/reference-data'

type ArgsT = {
  investmentId: number
  tree: KosztorysTreeT
  preview?: boolean
  clientView?: ClientViewSettingsT
  worker?: WorkerAudienceT
  lock?: InvestmentLockT
  undoRedo: UndoRedoApiT
  workers?: WorkerRefT[]
  hasSettledMaterial?: boolean
  // Absent on the podglądy, where its absence is
  // what switches both rows off — an empty array would mean „nothing is in the cennik".
  workCatalogue?: WorkCatalogueItemT[]
  onStaleTree?: () => Promise<unknown>
  isTemplate?: boolean
  filledStageIds?: ReadonlySet<number>
  seams?: PreviewSeamsT
}

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
  const actions = useEditorActions()
  // Interaction, split from disclosure: `preview` decides what a client is SHOWN, this decides whether
  // anything may be written.
  const readOnly = preview || lock !== undefined
  const { recoverStaleTree, reportFailure } = useStaleTreeRecovery(onStaleTree)
  const { save, runNow, drain, drainAll } = useDebouncedSave(500, recoverStaleTree)
  const { push, undo, redo, canUndo, canRedo, pruneByIds, amendTop } = undoRedo
  const [gridRef, gridHeight, gridNode] = useElementHeight()
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() =>
    seams ? seams.initialRowPatch(treeToRows(tree)) : treeToRows(tree),
  )
  const [sections, setSections] = useState<SectionMetaT[]>(() => treeToSections(tree))
  const documentSettings = worker?.settings ?? clientView
  const aiDraft = useMemo(() => hasAiDraft(rows), [rows])
  const {
    view,
    setView,
    offerAvailable,
    offer,
    setOffer,
    aiReviewAvailable,
    aiReview,
    setAiReview,
    search,
    setSearch,
    engagedConditionIds,
    showAllRows,
    setShowAllRows,
    reportedOnly,
    setReportedOnly,
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
    aiDraft,
  })

  const { widths, setWidth, dropWidth } = useColumnWidths()
  const { colors: columnColors, setColor: setColumnColor, dropColor } = useColumnColors()
  const { heights: rowHeights, setHeight: setRowHeight, dropHeight } = useRowHeights(isTemplate)
  const columnPrefsScope = isTemplate ? 'workshop' : 'kosztorys'
  const { isHidden, toggleColumn, setAllColumns } = useHiddenColumns(columnPrefsScope)
  const {
    ranks: columnRanks,
    setRank: setColumnRank,
    resetOrder: resetColumnOrder,
  } = useColumnOrder(columnPrefsScope)
  const [moneyAxis, setMoneyAxis] = useMoneyAxis()
  const axis = effectiveMoneyAxis(view, moneyAxis)
  const [layer, setLayer] = useLayer()
  const [storedCrewAxis, setCrewAxis] = useCrewAxis()
  const crewAxis = effectiveCrewAxis(view, storedCrewAxis)
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))
  const rowsRef = useRef(rows)

  // eslint-disable-next-line react-hooks/refs
  rowsRef.current = rows
  const sectionsRef = useRef(sections)
  // eslint-disable-next-line react-hooks/refs
  sectionsRef.current = sections
  // A ref, not state: opening the dialog must not re-render the grid (EX-496).
  const newItemDialogRef = useRef<
    ((placement: NewItemPlacementT, description?: string) => void) | null
  >(null)

  const { stages, adoptStage, handleAddStage, stageOps } = useKosztorysStageOps({
    investmentId,
    initialStages: tree.stages,
    patchRows,
    // Stage column ids come from DB ids Postgres may reissue — a dead etap's colour must not
    // resurface on a new one, same as its width.
    dropWidth: (...keys) => {
      dropWidth(...keys)
      dropColor(...keys)
    },
    save,
    reportFailure,
  })
  const {
    isStageHidden,
    isStageOff,
    hideCompleted: hideCompletedStages,
    setHideCompleted: setHideCompletedStages,
    toggleStage,
    setStagesHidden,
  } = useHiddenStages(investmentId, stages)

  const pendingFields = useRef<FieldChangeT[]>([])
  const pendingStages = useRef<StageChangeT[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hasPendingBurst, setHasPendingBurst] = useState(false)

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

  function clearBurstIfEmpty() {
    if (pendingFields.current.length > 0 || pendingStages.current.length > 0) return
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    setHasPendingBurst(false)
  }

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

  function pushReversible<T>(
    label: string,
    apply: (state: T) => void,
    before: T,
    after: T,
    touchedIds?: number[],
  ) {
    pushCommand({ label, undo: () => apply(before), redo: () => apply(after), touchedIds })
  }

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

  const editorOnly = <T>(handler: T): T | undefined => (readOnly ? undefined : handler)

  const subcontractorDue = useMemo(() => subcontractorDueByPlane(rows, stages), [rows, stages])

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

  // The coefficients come from a ROW, not from `tree`:
  // the owner changes them mid-session and the settings hook patches them onto the rows,
  // while `tree` still carries what the server last served.
  const catalogueComparison = useMemo(() => {
    if (preview || !workCatalogue || rows.length === 0) return null
    return buildCatalogueComparison(rows, workCatalogue, {
      wToolsCoeff: rows[0].globalWToolsCoeff,
      ownToolsCoeff: rows[0].globalOwnToolsCoeff,
      linkedRowsAreCatalogue: isTemplate,
    })
  }, [preview, rows, workCatalogue, isTemplate])

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

  const qtyDoneByRowId = useMemo(() => qtyDoneByRow(rows, stages), [rows, stages])
  const conditionCtx = useMemo<RowConditionCtxT>(
    () => ({
      stages,
      hasSettledMaterial,
      divergentPriceRowIds: divergentPriceIds,
      qtyDoneByRowId,
      catalogueRowIds,
      hasAiDraft: aiDraft,
      aiColumnsShown: aiReview,
    }),
    [
      stages,
      hasSettledMaterial,
      divergentPriceIds,
      qtyDoneByRowId,
      catalogueRowIds,
      aiDraft,
      aiReview,
    ],
  )

  // Counted over the whole dataset: once a filter is on, a count of what survives it is a count of
  // itself and can never reach zero to say the problem is gone.
  const rowConditionCounts = useMemo(
    () =>
      ROW_CONDITIONS.map(
        (condition) =>
          [condition.id, preview ? 0 : countMatching(rows, condition.id, conditionCtx)] as const,
      ),
    [preview, rows, conditionCtx],
  )
  const clientEmptyRowIds = useMemo(
    () =>
      preview
        ? rowIdsMatching(rows, clientConditionIds(documentSettings?.hideEmptyRows), conditionCtx)
        : NO_ROW_IDS,
    [preview, documentSettings?.hideEmptyRows, rows, conditionCtx],
  )
  // Over the view's own etapy: a subcontractor view already drops plane-less etapy, so counting the raw
  // list would offer a filter that can only empty the stage block.
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

  const engagedStageConditionIds = useMemo(
    () => (preview ? new Set<string>() : engagedStageProblemIds(engagedConditionIds)),
    [preview, engagedConditionIds],
  )

  const revealedColumnIds = useMemo(() => {
    const revealed = columnsRevealedBy(preview ? [] : engagedConditionIds)
    return aiReview ? new Set([...revealed, ...AI_REVIEW_COLUMN_IDS]) : revealed
  }, [preview, engagedConditionIds, aiReview])

  const divergenceFilterEngaged = !preview && engagedConditionIds.has(MEASURE_DIVERGED_CONDITION_ID)

  const documentHiddenColumns = useMemo(() => {
    if (!preview) return undefined
    if (worker) {
      return workerDataHiddenColumns(rows, stages, worker.settings.hidePlannedOnceExecuted)
    }
    return new Set([
      ...(clientView?.hiddenColumns ?? []),
      ...investorEmptyColumnIds(rows, stages, filledStageIds),
    ])
  }, [preview, worker, clientView, rows, stages, filledStageIds])

  const onAddItem = editorOnly(handleAddItem)
  const gridDictionary = useTranslation('grid')

  const columnOpts = {
    view,
    stages,
    stageOps: editorOnly(stageOps),
    workers,
    executedValueByStage: subcontractorDue.byStage,
    scaledDownStageIds: subcontractorDue.scaledDownStageIds,
    sort,
    onSetSort: editorOnly(setSortField),
    isHidden,
    isStageHidden: isStageOff,
    moneyAxis: axis,
    layer,
    crewAxis,
    widths,
    columnRanks,
    onGuide: setGuideX,
    onCommitColumn: setWidth,
    columnColors: preview ? undefined : columnColors,
    onSetColumnColor: editorOnly(setColumnColor),
    onRemoveItem: editorOnly(handleRemoveItem),
    onInsertItem: editorOnly(handleInsertItem),
    onRenameSection: editorOnly(handleRenameSection),
    onRemoveSection: editorOnly(handleRemoveSection),
    onInsertSection: editorOnly(handleInsertSection),
    onSetSectionColor: editorOnly(handleSetSectionColor),
    onPersistKosztorysOrder: editorOnly(handlePersistKosztorysOrder),
    // A szablon cell edit already writes the katalog (EX-1017); its row's own columns are a stale
    // copy, so pushing them would revert the cennik.
    canSaveItemToCatalogue: editorOnly(!isTemplate),
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
    catalogueEntryByRowId: catalogueComparison?.entryByItemId,
    hasAiDraft: aiDraft,
    offerVisible: offer,
    aiColumnsShown: aiReview,
    dictionary: gridDictionary,
  }
  const grid = buildV2Grid(columnOpts)
  const { columnToggleItems, columnBaseRanks } = grid
  const columns = seams ? seams.transformColumns(grid.columns) : grid.columns
  // A sort must not outlive its column: a money-axis or view toggle can drop the sorted column and its
  // SortHeader — the only control that clears the sort — freezing the rows in an unexplained order with
  // the row actions disabled (EX-486).
  const renderedFieldIds = new Set(
    columns.map((c) => c.id).filter((id): id is string => id != null),
  )
  if (reconcileSort(sort, renderedFieldIds) !== sort) setSort(null)

  const documentRows = useMemo(
    () => (preview ? applyRowConditions(rows, engagedConditionIds, conditionCtx) : rows),
    [preview, rows, engagedConditionIds, conditionCtx],
  )

  const subtotals = useMemo(
    () => sectionSubtotalsForView(documentRows, stages, view),
    [documentRows, stages, view],
  )
  const foldableSectionIds = useMemo(() => {
    if (preview) return new Map<string, Set<number>>()
    return new Map(
      ROW_CONDITIONS.filter(liftsToSections).map((condition) => [
        condition.id,
        sectionIdsWhereAllMatch(rows, condition.id, conditionCtx),
      ]),
    )
  }, [preview, rows, conditionCtx])

  const latchedConditions = useMemo(
    () => engagedLatchingIds(engagedConditionIds),
    [engagedConditionIds],
  )
  const { latch, refresh: refreshProblemRows } = useConditionRowLatch(
    latchedConditions,
    latchedConditions.size > 0,
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
  // Recognised ids only: a persisted id from a since-removed condition narrows nothing and shows no
  // chip, so counting it would hide every itemless band with no way for the owner to get them back.
  const showItemless =
    !preview &&
    search.trim() === '' &&
    !ROW_CONDITIONS.some((condition) => engagedConditionIds.has(condition.id))
  const totalNet = useMemo(() => subtotals.reduce((s, x) => s + x.net, 0), [subtotals])
  // Rounded, not raw: each rabat is a percent of a gross, so
  // summing hundreds surfaces error around the 11th digit and this is typed into the kwota field as text.
  const perItemDiscountTotal = useMemo(
    () => roundToCents(subtotals.reduce((s, x) => s + x.discount, 0)),
    [subtotals],
  )
  const itemsWithDiscountCount = useMemo(
    () => rows.filter((r) => r.discountValue > 0).length,
    [rows],
  )
  const stageTotals = useMemo(() => stageAxisForView(rows, stages, view).net, [rows, stages, view])
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
  const progressSubtotals = useMemo(
    () => sectionSubtotalsForView(rows, stages, 'client'),
    [rows, stages],
  )
  const { doneNet, laborCostsNetFromKosztorys, discountNetFromKosztorys, globalDiscountNet } =
    useMemo(
      () => clientTotalsFromSubtotals(progressSubtotals, globalDiscount),
      [progressSubtotals, globalDiscount],
    )
  const currentPlannedNet = useMemo(
    () => progressSubtotals.reduce((s, x) => s + x.currentPlannedNet, 0),
    [progressSubtotals],
  )

  const laborCostsNet = doneNet - globalDiscountNet

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
    await Promise.all(
      planReversalWrites(fields, stages, dir).map((w) =>
        w.kind === 'field'
          ? runNow(
              w.lane,
              () => actions.updateItemField(w.id, { [w.field]: w.value } as ItemPatchT),
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

  // Latest-value write alongside the state, so a second section gesture before the next render reads
  // the list the first one produced.
  function commitSections(next: SectionMetaT[]) {
    sectionsRef.current = next
    setSections(next)
  }

  function sectionMeta(sectionId: number) {
    return sectionsRef.current.find((section) => section.sectionId === sectionId)
  }

  function handleAddItem(sectionId: number, description?: string) {
    newItemDialogRef.current?.({ kind: 'end', sectionId }, description)
  }

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
      // Asked of the updater's rows, not rowsRef:
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
    const res = await settleAction(() => actions.removeItem(row.id))
    if (!res.success) {
      prevById.current.set(row.id, row)
      setRows((rs) => applyRestoreItem(rs, row, afterId))
      reportFailure(res.error, res.code)
    }
  }

  async function runKosztorysRenumber(next: number[], revertTo: number[]) {
    setRows((rs) => applyKosztorysOrder(rs, next))
    const res = await settleAction(() => actions.renumberOrder(investmentId, next))
    if (!res.success) {
      setRows((rs) => applyKosztorysOrder(rs, revertTo))
      reportFailure(res.error, res.code)
    }
  }

  function handlePersistKosztorysOrder() {
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

  function newSectionMeta(sectionId: number): SectionMetaT {
    return { sectionId, sectionName: DEFAULT_SECTION_NAME, sectionColor: null }
  }

  async function handleInsertSection(anchorSectionId: number, dir: 'above' | 'below') {
    if (!orderCommandsEnabled(sort)) return
    const res = await settleAction(() => actions.insertSection(anchorSectionId, dir))
    if (!res.success) return reportFailure(res.error, res.code)
    const meta = newSectionMeta(res.data.section.id)
    commitSections(insertSection(sectionsRef.current, meta, anchorSectionId, dir))
  }

  async function handleAddSection(): Promise<number | undefined> {
    const res = await settleAction(() => actions.addSection(investmentId))
    if (!res.success) {
      reportFailure(res.error, res.code)
      return undefined
    }
    const meta = newSectionMeta(res.data.section.id)
    commitSections(insertSection(sectionsRef.current, meta, null))
    return meta.sectionId
  }

  function rowsFromSections(treeSections: KosztorysTreeT['sections']) {
    const built = treeToRows({
      sections: treeSections,
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

  function handleAppendedSections(slice: KosztorysTreeT['sections']) {
    const appended = rowsFromSections(slice)
    commitSections([...sectionsRef.current, ...treeToSections({ sections: slice })])
    setRows((rs) => [...rs, ...appended])
  }

  function handleAppendedCatalogueItems(
    slice: KosztorysTreeT['sections'][number],
    createdSection: boolean,
  ) {
    const placement = catalogueSlicePlacement(
      new Set(sectionsRef.current.map((section) => section.sectionId)),
      slice.id,
      createdSection,
    )
    if (placement === 'reseed') return recoverStaleTree()
    const appended = rowsFromSections([slice])
    if (placement === 'prepend') {
      const [meta] = treeToSections({ sections: [slice] })
      commitSections(insertSection(sectionsRef.current, meta, null))
      setRows((rs) => [...appended, ...rs])
    } else {
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

  const { acceptReport } = useWorkerReportAcceptance({
    flushUndoBuffer,
    drain,
    adoptStage,
    patchRows,
    pruneByIds,
    adoptRevision,
    reportFailure,
  })

  async function handleRemoveSection(sectionId: number) {
    const removed = rowsRef.current
      .filter((r) => r.sectionId === sectionId)
      .map((r) => prevById.current.get(r.id) ?? r)
    const meta = sectionMeta(sectionId)
    const { next, index } = removeSection(sectionsRef.current, sectionId)
    commitSections(next)
    setRows((rs) => rs.filter((r) => r.sectionId !== sectionId))
    dropHeight(
      ...removed.map((r) => String(r.id)),
      String(sectionHeaderRowId(sectionId)),
      String(sectionFooterRowId(sectionId)),
    )
    for (const [id, r] of prevById.current) {
      if (r.sectionId === sectionId) prevById.current.delete(id)
    }
    flushUndoBuffer()
    pruneByIds([sectionHeaderRowId(sectionId), ...removed.map((r) => r.id)])
    // collapsedSectionIds is left alone: an id whose section left the list folds nothing, and it keeps
    // the fold state if the server rejects and the section comes back.
    const res = await settleAction(() => actions.removeSection(sectionId))
    if (!res.success) {
      for (const r of removed) prevById.current.set(r.id, r)
      const restored = meta ? restoreSection(sectionsRef.current, meta, index) : sectionsRef.current
      commitSections(restored)
      setRows((rs) => orderRowsBySections([...rs, ...removed], restored))
      reportFailure(res.error, res.code)
    }
  }

  const SECTION_ROW_FIELDS = { sectionName: 'name', sectionColor: 'color' } as const
  type SectionRowFieldT = keyof typeof SECTION_ROW_FIELDS

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
    const persist = immediate ? runNow : save
    persist(`section-field:${sectionId}:${rowKey}`, () =>
      actions.updateSectionField(sectionId, { [SECTION_ROW_FIELDS[rowKey]]: value }),
    )
  }

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
   * Both or neither — the klucz is the pair, so writing the nazwa alone moves the praca from one
   * „brak w katalogu" to another and the gesture looks like it did nothing.
   */
  async function handleAcceptCatalogueName(itemId: number, name: CatalogueNameT): Promise<boolean> {
    const before = rowsRef.current.find((r) => r.id === itemId)
    const patch = {
      ...name,
      descriptionTranslations: mergeTranslations(
        before?.descriptionTranslations,
        name.descriptionTranslations,
        name.description,
      ),
    }
    patchRows(
      (r) => r.id === itemId,
      (r) => ({ ...r, ...patch }),
    )
    const res = await settleAction(() => actions.updateItemField(itemId, patch))
    if (!res.success) {
      if (before)
        patchRows(
          (r) => r.id === itemId,
          (r) => ({
            ...r,
            description: before.description,
            unit: before.unit,
            descriptionTranslations: before.descriptionTranslations,
          }),
        )
      toastMessage(res.error, 'warning', 4000)
      return false
    }
    return true
  }

  function patchRows(
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) {
    setRows((rs) => rs.map((r) => (match(r) ? patch(r) : r)))
    for (const [id, r] of prevById.current) {
      if (match(r)) prevById.current.set(id, patch(r))
    }
  }

  function applyPreviewChanges(
    next: KosztorysV2RowT[],
    onPreviewChange: PreviewSeamsT['onPreviewChange'],
  ) {
    const { stageChanges, changedById } = planGridChanges(next, prevById.current)
    onPreviewChange(stageChanges)
    for (const row of next) if (prevById.current.has(row.id)) prevById.current.set(row.id, row)
    if (changedById.size > 0) setRows((master) => master.map((r) => changedById.get(r.id) ?? r))
  }

  function onChange(gridRows: KosztorysV2RowT[]) {
    if (preview) {
      if (seams) applyPreviewChanges(gridRows, seams.onPreviewChange)
      return
    }
    const next = applyReviewRules(gridRows, prevById.current, aiDraft)
    const { fieldChanges, stageChanges, changedById } = planGridChanges(next, prevById.current)
    for (const c of fieldChanges) {
      const key = c.field as keyof KosztorysV2RowT
      save(
        itemFieldLane(c.id, c.field),
        () => actions.updateItemField(c.id, { [c.field]: c.after } as ItemPatchT),
        () => {
          revertOne(c.id, key, c.before, c.after)
          dropPendingField(c.id, c.field)
        },
      )
    }
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
    for (const row of next) if (prevById.current.has(row.id)) prevById.current.set(row.id, row)
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

  async function flushPendingSaves() {
    flushUndoBuffer()
    await drainAll()
  }

  return {
    flushPendingSaves,
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
    isStageHidden,
    isStageOff,
    hideCompletedStages,
    setHideCompletedStages,
    toggleStage,
    setStagesHidden,
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
    setRowHeight,
    setGuideY,
    collapsedSectionIds,
    storedCollapsedSectionIds,
    toggleSectionCollapsed,
    setCollapsedSectionIds,
    onRenameSection: columnOpts.onRenameSection,
    onInsertSection: columnOpts.onInsertSection,
    onSetSectionColor: columnOpts.onSetSectionColor,
    onRemoveSection: columnOpts.onRemoveSection,
    onAddItem,
    subtotals,
    progressSubtotals,
    totalNet,
    columnTotals,
    sectionColumnTotals,
    stageTotals,
    stages,
    workers: workers ?? [],
    doneNet,
    laborCostsNetFromKosztorys,
    discountNetFromKosztorys,
    currentPlannedNet,
    globalDiscount,
    perItemDiscountTotal,
    itemsWithDiscountCount,
    isSavingSettings,
    investorImpactConfirm,
    subcontractorDue,
    marginForecastByPlane,
    catalogueComparison,
    workCatalogue,
    laborCostsNet,
    setView,
    offerAvailable,
    aiReviewAvailable,
    offer,
    setOffer,
    aiReview,
    setAiReview,
    search,
    setSearch,
    engagedConditionIds,
    engagedStageConditionIds,
    showAllRows,
    setShowAllRows,
    reportedOnly,
    setReportedOnly,
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
    handleGlobalCoeffChange,
    handleVatChange,
    handleSettlementModeChange,
    handleMaterialsNetRateChange,
    handleGlobalDiscountChange,
    handleApplyPercentDiscount,
    handleApplyCatalogueToItems,
    handleAcceptCatalogueName,
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
