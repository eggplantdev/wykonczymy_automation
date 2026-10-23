'use client'

import 'react-datasheet-grid/dist/style.css'
import { useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
// `DynamicDataSheetGrid`, not `DataSheetGrid`: the library aliases the plain name to
// StaticDataSheetGrid, which snapshots `columns` via useState at mount.
import { DynamicDataSheetGrid } from 'react-datasheet-grid'
import { KosztorysTotalsPanel } from '@/components/kosztorys/summary/kosztorys-totals-panel'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import { useTotalsPanelHeight } from '@/components/kosztorys/summary/hooks/use-totals-panel-height'
import { gridHeightBesidePanel } from '@/lib/kosztorys/totals-panel-height'
import { KosztorysEditorToolbar } from '@/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar'
import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import {
  reportEditorSeams,
  type ReportModeT,
} from '@/components/kosztorys/editor/grid/report-column'
import { useMediaQuery } from '@/hooks/use-media-query'
import { DESKTOP_MEDIA_QUERY, TABLET_LARGE_MEDIA_QUERY } from '@/lib/constants/breakpoints'
import {
  KosztorysEditorProvider,
  type OnTreeReplacedT,
} from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { CataloguePickerHost } from '@/components/kosztorys/editor/actions/catalogue-picker-host'
import { ReorderHost } from '@/components/kosztorys/editor/actions/reorder-host'
import { ColumnWidthHost } from '@/components/kosztorys/editor/actions/column-width-host'
import { NewItemHost } from '@/components/kosztorys/editor/actions/new-item-host'
import { useRowSizing } from '@/components/kosztorys/editor/hooks/use-row-sizing'
import { useUndoKeyboard } from '@/components/kosztorys/editor/hooks/use-undo-keyboard'
import { useSheetImport } from '@/components/kosztorys/editor/hooks/use-sheet-import'
import { SheetImportDialog } from '@/components/kosztorys/editor/dialogs/sheet/sheet-import-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { sectionFooterLabelColumnId } from '@/components/kosztorys/editor/grid/cells/section-footer-cell'
import { sectionBandLabelColumnId } from '@/components/kosztorys/editor/grid/cells/section-header-cell'
import {
  STRIPE_COLUMN_CLASS,
  withCellClass,
  withSyntheticRows,
} from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import { ordinalGutterColumn } from '@/components/kosztorys/editor/grid/ordinal-gutter-column'
import { buildSectionBandRows } from '@/lib/kosztorys/section-band-rows'
import { gridMinWidth } from '@/lib/kosztorys/grid-min-width'
import { editorNoun } from '@/lib/kosztorys/editor-noun'
import { useTranslation } from '@/hooks/use-translation'
import {
  isSectionFooterRow,
  isSectionHeaderRow,
  isSyntheticRow,
  makeSpacerRow,
  makeTotalsRow,
} from '@/lib/kosztorys/synthetic-rows'
import { CLIPPED_CELL_CLASS, wrapColumnClass } from '@/lib/kosztorys/row-content-lines'
import { HEADER_HEIGHT_KEY, resolveHeaderRowHeight } from '@/lib/kosztorys/row-height'
import { RowHeightFitProvider } from '@/components/kosztorys/editor/grid/row-height-fit-context'
import { sectionColorRail } from '@/lib/kosztorys/section-colors'
import { orderCommandsEnabled, sectionBandsVisible } from '@/lib/kosztorys/order-commands'
import { cn } from '@/lib/utils/cn'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import {
  NOOP_UNDO_REDO,
  type UndoRedoApiT,
} from '@/components/kosztorys/editor/hooks/use-undo-redo'
import { KosztorysLockedBanner } from '@/components/kosztorys/editor/kosztorys-locked-banner'
import { TemplateCatalogueBanner } from '@/components/kosztorys/editor/template-catalogue-banner'
import { HistoryBanner } from '@/components/kosztorys/editor/history/history-banner'
import { withHistoryChanges } from '@/components/kosztorys/editor/history/history-change-cell'
import { PreviewHeader } from '@/components/kosztorys/editor/preview-header-actions'
import { GridEmptyOverlay } from '@/components/kosztorys/editor/grid/grid-empty-overlay'
import { historyGridTree, stageIdsFilledNow } from '@/lib/kosztorys/history/history-grid'
import type { InvestorHistoryT } from '@/lib/kosztorys/history/types'
import type { KosztorysEditorDataT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'
import type { WorkerAudienceT } from '@/lib/kosztorys/worker-view/types'
import { pinnedWidth } from '@/components/kosztorys/editor/grid/column-sizing'

// Fits a 375px screen beside the ordinal gutter, so a description wraps on screen instead of
// running past its edge.
const PHONE_PREVIEW_DESCRIPTION_WIDTH = 280

type PropsT = KosztorysEditorDataT & {
  preview?: boolean
  clientView?: ClientViewSettingsT
  worker?: WorkerAudienceT
  history?: InvestorHistoryT
  undoRedo?: UndoRedoApiT
  hasCatalogueEdits?: boolean
  // Hands over the flush because the versions drawer lives outside this body, where a restore must
  // wait for the cell saves still pending in it.
  onOpenVersions?: (flushPendingSaves: () => Promise<void>) => void
  onTreeReplaced?: OnTreeReplacedT
  onStaleTree?: () => Promise<unknown>
  report?: ReportModeT & {
    header: (controls: ReportGridControlsT) => ReactNode
    footer: ReactNode
  }
}

type ReportGridControlsT = {
  search: string
  onSearch: (value: string) => void
  showAllRows: boolean
  onShowAllRows: (value: boolean) => void
  hiddenRowCount: number
  reportedOnly: boolean
  onReportedOnly: (value: boolean) => void
}

export function KosztorysEditorBody({
  investmentId,
  tree,
  investmentName,
  laborCostsNetFromTransactions,
  discountNetFromTransactions,
  investmentLoss,
  depositTransactions,
  preview = false,
  clientView,
  worker,
  history,
  lock,
  hasSheet = false,
  isTemplate = false,
  undoRedo = NOOP_UNDO_REDO,
  hasCatalogueEdits = false,
  onOpenVersions,
  onTreeReplaced,
  onStaleTree,
  report,
  workers,
  workCatalogue,
  assets,
  investment,
  trashed,
  workerReports,
  ...panelData
}: PropsT) {
  const hasSettledMaterial = panelData.settledBreakdown.length > 0
  const noun = editorNoun(isTemplate)
  const gridCopy = useTranslation('grid')
  const totalLabel = gridCopy.t('total')
  const investorHistory = worker ? undefined : history
  const pastVersion = investorHistory?.version ?? null
  const gridTree = pastVersion ? historyGridTree(pastVersion) : tree
  const filledStageIds = pastVersion ? stageIdsFilledNow(pastVersion.diff) : undefined
  const removedItemIds = new Set(pastVersion?.diff.removed.map(({ id }) => id))
  const isWide = useMediaQuery(DESKTOP_MEDIA_QUERY)
  const showsUnit = useMediaQuery(TABLET_LARGE_MEDIA_QUERY)
  const editor = useKosztorysEditor({
    investmentId,
    tree: gridTree,
    preview,
    clientView,
    worker,
    lock,
    undoRedo,
    workers,
    hasSettledMaterial,
    workCatalogue,
    onStaleTree,
    isTemplate,
    filledStageIds,
    seams:
      report &&
      worker &&
      reportEditorSeams(report, { stages: tree.stages, worker }, { isWide, showsUnit }),
  })
  const {
    gridRef,
    gridNode,
    gridHeight,
    columns,
    viewRows,
    guideX,
    guideY,
    rowHeights,
    fitRowsToContent,
    setRowHeight,
    setGuideY,
    subtotals,
    progressSubtotals,
    columnTotals,
    sectionColumnTotals,
    stageTotals,
    stages,
    totalNet,
    laborCostsNetFromKosztorys,
    discountNetFromKosztorys,
    laborCostsNet,
    subcontractorDue,
    marginForecastByPlane,
    sort,
    search,
    engagedConditionIds,
    showAllRows,
    setShowAllRows,
    reportedOnly,
    setReportedOnly,
    clientEmptyRowIds,
    resetFilters,
    ordinalByRowId,
    sections,
    showItemless,
    setSearch,
    collapsedSectionIds,
    toggleSectionCollapsed,
    onRenameSection,
    onInsertSection,
    onSetSectionColor,
    onRemoveSection,
    onAddItem,
    onChange,
  } = editor

  useUndoKeyboard(editor.undo, editor.redo)

  const { openImport, importDialogProps } = useSheetImport({ investmentId, onTreeReplaced })

  const isReportCompact = report !== undefined && !report.isSummary
  const pageScroll = report !== undefined
  // its toggle is `disabled`
  // on an empty kosztorys, so a panel left open would be a sheet of zeros nobody could fold away.
  const hasTotalsPanel =
    !worker && !pastVersion && !isTemplate && (!preview || subtotals.length > 0)
  const [totalsOpen] = useTotalsPanelOpen(subtotals.length > 0)
  const [totalsFraction] = useTotalsPanelHeight()
  const gridHeightBesideTotals = hasTotalsPanel
    ? gridHeightBesidePanel(gridHeight, { open: totalsOpen, fraction: totalsFraction })
    : gridHeight
  // Hand-memoized: these reach dsg as `columns`, and the compiler drops their cache, so every
  // keystroke would make dsg re-process every column.
  const sectionHeader = useMemo(
    () => ({
      figures: new Map(
        subtotals.map((section) => [
          section.sectionId,
          { itemCount: section.itemCount, net: section.net },
        ]),
      ),
      collapsedSectionIds,
      onToggleCollapsed: toggleSectionCollapsed,
      onRename: onRenameSection,
      actions:
        onInsertSection && onSetSectionColor && onRemoveSection && onAddItem
          ? {
              onInsert: onInsertSection,
              onSetColor: onSetSectionColor,
              onRemove: onRemoveSection,
              onAddItem,
            }
          : undefined,
      sortActive: !orderCommandsEnabled(sort),
      labelColumnId: sectionBandLabelColumnId(columns.map((column) => column.id)),
      isBare: isReportCompact,
    }),
    [
      isReportCompact,
      subtotals,
      collapsedSectionIds,
      toggleSectionCollapsed,
      onRenameSection,
      onInsertSection,
      onSetSectionColor,
      onRemoveSection,
      onAddItem,
      sort,
      columns,
    ],
  )

  const sectionFooter = useMemo(
    () => ({
      figures: sectionColumnTotals,
      labelColumnId: sectionFooterLabelColumnId(columns.map((column) => column.id)),
    }),
    [sectionColumnTotals, columns],
  )

  const fitsDescriptionToPhone = preview && !report && !isWide
  const gridColumns = useMemo(
    () =>
      columns
        .map((column) =>
          fitsDescriptionToPhone && column.id === 'description'
            ? { ...column, ...pinnedWidth(PHONE_PREVIEW_DESCRIPTION_WIDTH) }
            : column,
        )
        .map((column) => (pastVersion ? withHistoryChanges(column, pastVersion.diff) : column))
        .map((column) =>
          column.id
            ? { ...column, headerClassName: cn(column.headerClassName, wrapColumnClass(column.id)) }
            : column,
        )
        .map((column, index) =>
          withSyntheticRows(
            // A class per column rather than `:nth-child` in CSS: dsg virtualizes columns, so a
            // horizontal scroll shifts which DOM child a column is and the stripes would swap.
            preview && index % 2 === 1
              ? {
                  ...column,
                  cellClassName: withCellClass(column.cellClassName, STRIPE_COLUMN_CLASS),
                  headerClassName: cn(column.headerClassName, STRIPE_COLUMN_CLASS),
                }
              : column,
            { totals: columnTotals, totalLabel, sectionHeader, sectionFooter },
          ),
        ),
    [
      columns,
      fitsDescriptionToPhone,
      pastVersion,
      preview,
      columnTotals,
      totalLabel,
      sectionHeader,
      sectionFooter,
    ],
  )
  // a no-hit search empties `viewRows` over a kosztorys that is not in fact empty.
  const isEmpty = preview ? subtotals.length === 0 && !reportedOnly : sections.length === 0
  const banded = buildSectionBandRows(viewRows, {
    enabled: sectionBandsVisible(sort),
    collapsedSectionIds,
    sections,
    showItemless,
  })
  const bodyRows = isReportCompact ? banded.filter((row) => !isSectionFooterRow(row.id)) : banded
  const gridRows = [...bodyRows, makeSpacerRow(), makeTotalsRow()]
  const gridRowKeys = gridRows.map((row) => String(row.id))
  const { datasheetRef, textSize, rowResize, fitRowToContent, rowHeightFor, isClipped } =
    useRowSizing({
      gridNode,
      columns,
      viewRows,
      gridRowKeys,
      preview,
      report,
      fitRowsToContent,
      rowHeights,
      setRowHeight,
      setGuideY,
    })
  const hasWidthCommand = !preview && !report && !editor.readOnly
  // dsg offers no slot inside its scroller, so the footer is portaled into it.
  const [reportFooterAnchor, setReportFooterAnchor] = useState<HTMLElement | null>(null)
  const reportFooterHost =
    reportFooterAnchor?.parentElement?.querySelector<HTMLElement>('.dsg-container') ?? undefined
  const gutterColumn = useMemo(
    () => ordinalGutterColumn({ ordinals: ordinalByRowId, resize: rowResize }),
    [ordinalByRowId, rowResize],
  )
  const hidesGutter = isReportCompact && !isWide
  // The report's full sheet is wider than a phone, but dsg renders only the columns inside its own
  // box — so the box gets the columns' width up front.
  const reportMinWidth = report?.isSummary
    ? gridMinWidth(gridColumns, hidesGutter ? 0 : (gutterColumn.basis ?? 40))
    : undefined

  const reconciliation = buildKosztorysReconciliation({
    laborCostsNetFromKosztorys,
    discountNetFromKosztorys,
    laborCostsNetFromTransactions,
    discountNetFromTransactions,
  })

  return (
    <KosztorysEditorProvider
      editor={{
        ...editor,
        investmentId,
        investmentName,
        tree: gridTree,
        onOpenVersions:
          editor.readOnly || !onOpenVersions
            ? undefined
            : () => onOpenVersions(editor.flushPendingSaves),
        onTreeReplaced,
        openImport: editor.readOnly ? undefined : openImport,
        hasSheet,
        isTemplate,
        isTrashed: lock === 'trashed',
        noun,
      }}
    >
      {/* Wraps the body, not the grid: the value reaches a row's „…" through Radix's portal, which
          keeps the React tree even though the DOM leaves it. */}
      <RowHeightFitProvider fit={fitRowToContent}>
        <CataloguePickerHost>
          <NewItemHost>
            <ReorderHost>
              <ColumnWidthHost
                datasheetRef={datasheetRef}
                columns={gridColumns}
                enabled={hasWidthCommand}
              >
                {/* As wide as the full sheet, so the report's header has room to stay pinned left while
              the page scrolls sideways — a sticky box never leaves its parent. */}
                <div
                  className={cn(
                    'flex w-full flex-col',
                    pageScroll ? 'min-h-dvh' : 'overflow-hidden',
                    !pageScroll && (preview ? 'h-dvh' : 'h-below-top-nav'),
                  )}
                  style={reportMinWidth ? { minWidth: reportMinWidth } : undefined}
                >
                  {report ? (
                    report.header({
                      search,
                      onSearch: setSearch,
                      showAllRows,
                      onShowAllRows: setShowAllRows,
                      hiddenRowCount: clientEmptyRowIds.size,
                      reportedOnly,
                      onReportedOnly: setReportedOnly,
                    })
                  ) : preview ? (
                    <PreviewHeader
                      investmentName={investmentName}
                      workerName={worker?.name}
                      history={investorHistory}
                      hasRows={subtotals.length > 0}
                      emptyRowCount={clientEmptyRowIds.size}
                      showAllRows={showAllRows}
                      onShowAllRowsChange={setShowAllRows}
                    />
                  ) : (
                    <>
                      <KosztorysEditorToolbar
                        workerReports={workerReports}
                        protocolSource={
                          investment && !isTemplate
                            ? {
                                investment,
                                materials: {
                                  grossBase: panelData.materialsGrossBase,
                                  netBilled: panelData.materialsNetBilled,
                                },
                                depositTransactions,
                                lossAmount: investmentLoss,
                              }
                            : undefined
                        }
                      />
                      {lock && <KosztorysLockedBanner lock={lock} />}
                      {hasCatalogueEdits && <TemplateCatalogueBanner />}
                    </>
                  )}
                  {preview && <HistoryBanner version={pastVersion} />}
                  {/* datasheet-grid
            needs px for virtualization; without it, it renders all 1000 rows. */}
                  <div
                    className={cn('relative flex min-h-0 flex-1', !pageScroll && 'overflow-hidden')}
                  >
                    <div
                      ref={gridRef}
                      data-grid-text-size={textSize}
                      className={cn(
                        'grid min-h-0 min-w-0 flex-1 grid-cols-1',
                        !pageScroll && 'overflow-hidden',
                      )}
                    >
                      {/* What useWrapColumnWidths reads the font from — there before the first row is. */}
                      <span
                        aria-hidden
                        className="grid-cell-text pointer-events-none invisible absolute"
                      />
                      <DynamicDataSheetGrid
                        ref={datasheetRef}
                        className={cn(
                          'kosztorys-grid',
                          preview && 'kosztorys-grid-preview',
                          report && 'kosztorys-grid-report',
                          isReportCompact && 'kosztorys-grid-report-compact',
                        )}
                        style={reportMinWidth ? { minWidth: reportMinWidth } : undefined}
                        value={gridRows}
                        onChange={(rows) => onChange(rows.filter((row) => !isSyntheticRow(row.id)))}
                        columns={gridColumns}
                        gutterColumn={hidesGutter ? false : gutterColumn}
                        height={gridHeightBesideTotals}
                        rowHeight={({ rowData }) => rowHeightFor(rowData)}
                        headerRowHeight={resolveHeaderRowHeight(
                          preview ? undefined : rowHeights[HEADER_HEIGHT_KEY],
                        )}
                        lockRows
                        rowKey={({ rowData }) => String(rowData.id)}
                        cellClassName={({ rowData, columnId }) =>
                          columnId && isClipped(rowData as KosztorysV2RowT, columnId)
                            ? CLIPPED_CELL_CLASS
                            : undefined
                        }
                        rowClassName={({ rowData }) =>
                          cn(
                            sectionColorRail(rowData.sectionColor),
                            isSectionHeaderRow(rowData.id) && 'kosztorys-section-header',
                            isSectionFooterRow(rowData.id) && 'kosztorys-section-footer',
                            showAllRows &&
                              clientEmptyRowIds.has(rowData.id) &&
                              'kosztorys-revealed-row',
                            removedItemIds.has(rowData.id) && 'kosztorys-history-removed',
                          )
                        }
                      />
                      {report && <span hidden ref={setReportFooterAnchor} />}
                      {report && reportFooterHost && createPortal(report.footer, reportFooterHost)}
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0 flex"
                      style={{ height: hasTotalsPanel ? gridHeightBesideTotals : undefined }}
                    >
                      <GridEmptyOverlay
                        isEmpty={isEmpty}
                        hasVisibleRows={viewRows.length > 0}
                        preview={preview}
                        isTemplate={isTemplate}
                        search={search}
                        engagedConditionIds={engagedConditionIds}
                        onImport={!editor.readOnly && hasSheet ? openImport : undefined}
                        onClearSearch={() => setSearch('')}
                        onResetFilters={resetFilters}
                      />
                    </div>
                    {hasTotalsPanel && (
                      <KosztorysTotalsPanel
                        hasRows={subtotals.length > 0}
                        availableHeight={gridHeight}
                        {...panelData}
                        investmentId={investmentId}
                        investmentName={investmentName}
                        investment={investment}
                        trashed={trashed}
                        assets={assets}
                        depositTransactions={depositTransactions}
                        stages={stages}
                        stageTotals={stageTotals}
                        workers={workers}
                        subcontractorDue={subcontractorDue}
                        marginForecastByPlane={marginForecastByPlane}
                        totalNet={totalNet}
                        laborCostsNet={laborCostsNet}
                        sectionSubtotals={progressSubtotals}
                        discountAmount={discountNetFromKosztorys}
                        lossAmount={investmentLoss}
                        reconciliation={reconciliation}
                        vatRate={tree.vatRate}
                        settlementMode={tree.settlementMode}
                        onSettlementModeChange={
                          editor.readOnly ? undefined : editor.handleSettlementModeChange
                        }
                        materialsNetRate={tree.materialsNetRate}
                        onMaterialsNetRateChange={
                          editor.readOnly ? undefined : editor.handleMaterialsNetRateChange
                        }
                        isSavingSettings={editor.isSavingSettings}
                        preview={preview}
                      />
                    )}
                  </div>
                  {/* <main> uses transform-gpu, which would otherwise make this `fixed` element measure `left`
            from <main> (sidebar-offset) instead of the viewport */}
                  {guideX !== null &&
                    createPortal(
                      <div
                        className="bg-primary/70 pointer-events-none fixed inset-y-0 z-50 w-px"
                        style={{ left: guideX }}
                      />,
                      document.body,
                    )}
                  {guideY !== null &&
                    createPortal(
                      <div
                        className="bg-primary/70 pointer-events-none fixed inset-x-0 z-50 h-px"
                        style={{ top: guideY }}
                      />,
                      document.body,
                    )}
                  {!preview && (
                    <SheetImportDialog {...importDialogProps} workers={editor.workers} />
                  )}
                  {!preview && <ConfirmDialog {...editor.investorImpactConfirm} />}
                </div>
              </ColumnWidthHost>
            </ReorderHost>
          </NewItemHost>
        </CataloguePickerHost>
      </RowHeightFitProvider>
    </KosztorysEditorProvider>
  )
}
