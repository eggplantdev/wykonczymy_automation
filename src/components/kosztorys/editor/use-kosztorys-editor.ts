'use client'

import { useMemo } from 'react'
import type { Column } from 'react-datasheet-grid'
import { useDebouncedSave } from '@/components/kosztorys/editor/hooks/use-debounced-save'
import { useStaleTreeRecovery } from '@/components/kosztorys/editor/hooks/use-stale-tree-recovery'
import { useExternalChangeReload } from '@/components/kosztorys/editor/hooks/use-external-change-reload'
import { useWorkerReportAcceptance } from '@/components/kosztorys/editor/hooks/use-worker-report-acceptance'
import { useEditorRows } from '@/components/kosztorys/editor/hooks/use-editor-rows'
import { useUndoBursts } from '@/components/kosztorys/editor/hooks/use-undo-bursts'
import { useSectionCrud } from '@/components/kosztorys/editor/hooks/use-section-crud'
import { useItemOps } from '@/components/kosztorys/editor/hooks/use-item-ops'
import { useCatalogueOps } from '@/components/kosztorys/editor/hooks/use-catalogue-ops'
import { useGridChangePipeline } from '@/components/kosztorys/editor/hooks/use-grid-change-pipeline'
import {
  undoAvailability,
  type FieldChangeT,
  type StageChangeT,
} from '@/lib/kosztorys/undo-coalesce'
import { buildReversalPatches, planReversalWrites } from '@/lib/kosztorys/undo-reversal'
import type { UndoRedoApiT } from '@/components/kosztorys/editor/hooks/use-undo-redo'
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
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { columnTotalsForRows } from '@/lib/kosztorys/columns/column-totals'
import { sectionSubtotalsForView, stageAxisForView } from '@/lib/kosztorys/settlement-aggregates'
import { clientTotalsFromSubtotals } from '@/lib/kosztorys/settlement-client-totals'
import { subcontractorDueByPlane } from '@/lib/kosztorys/subcontractor-due'
import { marginForecastByPlane as forecastByPlane } from '@/lib/kosztorys/margin-forecast'
import { divergentPriceRowIds } from '@/lib/kosztorys/price-divergence'
import { qtyDoneByRow } from '@/lib/kosztorys/row-conditions/ctx'
import type { RowConditionCtxT } from '@/lib/kosztorys/row-conditions/types'
import { buildViewRows } from '@/lib/kosztorys/row-view'
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
import { hasPlannedDiscount, investorEmptyColumnIds } from '@/lib/kosztorys/settlement-columns'
import { workerDataHiddenColumns } from '@/lib/kosztorys/worker-view/columns'
import { baseOrdinals } from '@/lib/kosztorys/section-band-rows'
import { reconcileSort } from '@/lib/kosztorys/columns/sort-value'
import type { InvestmentLockT } from '@/lib/constants/investment-lock'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { setStageProgressAction } from '@/lib/actions/kosztorys-stages'
import { useEditorActions } from '@/components/kosztorys/editor/actions/editor-actions-context'
import { buildCatalogueComparison } from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import { AI_REVIEW_COLUMN_IDS } from '@/lib/kosztorys/ai-review-columns'
import { hasAiDraft } from '@/lib/kosztorys/review-status'
import type { ItemPatchT, KosztorysTreeT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { toastMessage } from '@/lib/utils/toast'
import { useTranslation } from '@/hooks/use-translation'
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
  const editorRows = useEditorRows(tree, seams?.initialRowPatch)
  const { rows, rowsRef, patchRows, revertOne } = editorRows
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
    globalDiscountActive: rows.some((row) => row.globalDiscountActive),
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
  const { isStageOff, toggleStage, setStagesHidden } = useHiddenStages(investmentId, stages)

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

  const undoBursts = useUndoBursts({ push, amendTop, reverse: runGridReversal })
  const { hasPendingBurst, flushUndoBuffer, pushCommand, pushReversible } = undoBursts

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

  const latchedConditions = useMemo(
    () => engagedLatchingIds(engagedConditionIds),
    [engagedConditionIds],
  )
  const { latch, refresh: refreshProblemRows } = useConditionRowLatch(
    latchedConditions,
    latchedConditions.size > 0,
  )
  // The latch only takes rows once they render, and a new praca with no przedmiar and no etapy never
  // would under the usual filters.
  const holdNewRow = (rowId: number) => latch?.ids.add(rowId)

  const sectionCrud = useSectionCrud({
    investmentId,
    tree,
    stages,
    globalDiscount,
    sort,
    editorRows,
    actions,
    save,
    runNow,
    reportFailure,
    recoverStaleTree,
    flushUndoBuffer,
    pruneByIds,
    pushReversible,
    dropHeight,
    unfoldSection,
    holdNewRow,
  })
  const {
    sections,
    handleInsertSection,
    handleAddSection,
    handleAppendedSections,
    handleAppendedCatalogueItems,
    handleRemoveSection,
    handleSetSectionColor,
    handleRenameSection,
  } = sectionCrud
  const {
    newItemDialogRef,
    handleAddItem,
    handleInsertItem,
    placeNewItem,
    handleRemoveItem,
    handlePersistKosztorysOrder,
  } = useItemOps({
    investmentId,
    stages,
    sort,
    view,
    editorRows,
    sectionCrud,
    actions,
    reportFailure,
    flushUndoBuffer,
    pushCommand,
    pruneByIds,
    dropHeight,
    unfoldSection,
    holdNewRow,
  })
  const { handleApplyCatalogueToItems, handleAcceptCatalogueName } = useCatalogueOps({
    investmentId,
    editorRows,
    actions,
  })
  const { onChange } = useGridChangePipeline({
    preview,
    aiDraft,
    onPreviewChange: seams?.onPreviewChange,
    editorRows,
    actions,
    save,
    undoBursts,
  })

  const editorOnly = <T>(handler: T): T | undefined => (readOnly ? undefined : handler)

  // Hand-memoized below: the compiler merges these row scans into one scope spanning the hook calls and
  // drops its cache, so every render — several per keystroke — would rescan ~1000 pozycji.
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
  const catalogueComparison = useMemo(
    () =>
      preview || !workCatalogue || rows.length === 0
        ? null
        : buildCatalogueComparison(rows, workCatalogue, {
            wToolsCoeff: rows[0].globalWToolsCoeff,
            ownToolsCoeff: rows[0].globalOwnToolsCoeff,
            linkedRowsAreCatalogue: isTemplate,
          }),
    [preview, rows, workCatalogue, isTemplate],
  )

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
    // A szablon cell edit already writes the katalog; its row's own columns are a stale
    // copy, so pushing them would revert the cennik.
    canSaveItemToCatalogue: editorOnly(!isTemplate),
    globalDiscountActive,
    hasDiscount: hasPlannedDiscount(rows),
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
  // the row actions disabled.
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
  const foldableSectionIds = useMemo(
    () =>
      preview
        ? new Map<string, Set<number>>()
        : new Map(
            ROW_CONDITIONS.filter(liftsToSections).map((condition) => [
              condition.id,
              sectionIdsWhereAllMatch(rows, condition.id, conditionCtx),
            ]),
          ),
    [preview, rows, conditionCtx],
  )

  const viewRows = useMemo(() => {
    const next = buildViewRows({
      rows,
      search,
      engagedConditionIds,
      sort,
      view,
      ...conditionCtx,
      latch: latch ? { ids: latch.ids, rank: new Map() } : undefined,
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
    isStageOff,
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
