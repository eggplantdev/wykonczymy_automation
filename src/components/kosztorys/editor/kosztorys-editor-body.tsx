'use client'

import 'react-datasheet-grid/dist/style.css'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SheetIcon } from 'lucide-react'
// `DynamicDataSheetGrid`, not `DataSheetGrid`: the library aliases the plain name to
// StaticDataSheetGrid, which snapshots `columns` via useState at mount (EX-422).
import { DynamicDataSheetGrid, type DataSheetGridRef } from 'react-datasheet-grid'
import { KosztorysTotalsPanel } from '@/components/kosztorys/summary/kosztorys-totals-panel'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import { useTotalsPanelHeight } from '@/components/kosztorys/summary/hooks/use-totals-panel-height'
import { gridHeightBesidePanel } from '@/lib/kosztorys/totals-panel-height'
import { KosztorysEditorToolbar } from '@/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar'
import { BrandLogo } from '@/components/ui/brand-logo'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import {
  PHONE_REPORT_HEADER_HEIGHT,
  reportEditorSeams,
  reportScrollsSideways,
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
import { NewItemHost } from '@/components/kosztorys/editor/actions/new-item-host'
import { useRowHeightCacheReset } from '@/components/kosztorys/editor/hooks/use-row-height-cache-reset'
import { useWrapColumnWidths } from '@/components/kosztorys/editor/hooks/use-wrap-column-widths'
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
import {
  ordinalGutterColumn,
  type RowResizeApiT,
} from '@/components/kosztorys/editor/grid/ordinal-gutter-column'
import { buildSectionBandRows } from '@/lib/kosztorys/section-band-rows'
import { gridMinWidth } from '@/lib/kosztorys/grid-min-width'
import { engagedConditionsOfKind, engagedHiders } from '@/lib/kosztorys/row-conditions/queries'
import { emptyGridCopy } from '@/lib/kosztorys/empty-grid-copy'
import { editorNoun } from '@/lib/kosztorys/editor-noun'
import { useTranslation } from '@/hooks/use-translation'
import {
  isSectionFooterRow,
  isSectionHeaderRow,
  isSyntheticRow,
  makeSpacerRow,
  makeTotalsRow,
} from '@/lib/kosztorys/synthetic-rows'
import {
  CLIPPED_CELL_CLASS,
  columnLines,
  measuredColumns,
  rowContentLines,
  wrapColumnClass,
} from '@/lib/kosztorys/row-content-lines'
import { memoisedByRow } from '@/lib/kosztorys/columns/memoised-by-row'
import {
  HEADER_HEIGHT_KEY,
  fitRowHeight,
  heightForLines,
  resolveHeaderRowHeight,
  resolveRowHeight,
} from '@/lib/kosztorys/row-height'
import { RowHeightFitProvider } from '@/components/kosztorys/editor/grid/row-height-fit-context'
import { measureTextWidth } from '@/lib/utils/text-measure'
import { sectionColorRail } from '@/lib/kosztorys/section-colors'
import { orderCommandsEnabled, sectionBandsVisible } from '@/lib/kosztorys/order-commands'
import { cn } from '@/lib/utils/cn'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import {
  NOOP_UNDO_REDO,
  type UndoRedoApiT,
} from '@/components/kosztorys/editor/hooks/use-undo-redo'
import { KosztorysLockedBanner } from '@/components/kosztorys/editor/kosztorys-locked-banner'
import { HistoryBanner } from '@/components/kosztorys/editor/history/history-banner'
import { withHistoryChanges } from '@/components/kosztorys/editor/history/history-change-cell'
import { PreviewHeaderActions } from '@/components/kosztorys/editor/preview-header-actions'
import { historyGridTree, stageIdsFilledNow } from '@/lib/kosztorys/history/history-grid'
import type { InvestorHistoryT } from '@/lib/kosztorys/history/types'
import type { KosztorysEditorDataT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'
import type { WorkerAudienceT } from '@/lib/kosztorys/worker-view/types'

type PropsT = KosztorysEditorDataT & {
  // Read-only public render: hides the mutation chrome, kills persistence, gates the footer's
  // owner-only bits.
  preview?: boolean
  // Arrives with the preview payload only; the owner's editor renders the full grid regardless.
  clientView?: ClientViewSettingsT
  // The named worker's document; only ever with `preview`.
  worker?: WorkerAudienceT
  // The investor's change history; only ever with `preview`, and ignored with `worker`. With a
  // version open the grid renders that version, compared against `tree`.
  history?: InvestorHistoryT
  // Optional because the read-only client body omits it and falls back to NOOP_UNDO_REDO.
  undoRedo?: UndoRedoApiT
  onOpenVersions?: () => void
  onTreeReplaced?: OnTreeReplacedT
  // Reseed after a write was refused because its row is gone (the tree was replaced elsewhere).
  onStaleTree?: () => Promise<unknown>
  // Only ever with `worker`.
  report?: ReportModeT & {
    header: (controls: ReportGridControlsT) => ReactNode
    // Rendered inside dsg's container, right after the last row.
    footer: ReactNode
  }
}

export type ReportGridControlsT = {
  search: string
  onSearch: (value: string) => void
  showAllRows: boolean
  onShowAllRows: (value: boolean) => void
  hiddenRowCount: number
  reportedOnly: boolean
  onReportedOnly: (value: boolean) => void
}

// Seeds the grid from `tree` at mount, so remounting it with a fresh `key` is how a restore re-seeds
// the whole grid (see KosztorysEditorV2).
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
  onOpenVersions,
  onTreeReplaced,
  onStaleTree,
  report,
  workers,
  workCatalogue,
  assets,
  investment,
  workerReports,
  ...panelData
}: PropsT) {
  // A rozliczony wydatek means material was folded into robocizna, which is what makes a pozycja
  // priced off a coefficient hand the crew a cut of it (EX-708). The breakdown carries no link back
  // to a pozycja, so this is all the kosztorys can know.
  const hasSettledMaterial = panelData.settledBreakdown.length > 0
  const noun = editorNoun(isTemplate)
  const gridCopy = useTranslation('grid')
  const totalLabel = gridCopy.t('total')
  // The investor's history never reaches a crew's document, whatever a caller passes.
  const investorHistory = worker ? undefined : history
  const pastVersion = investorHistory?.version ?? null
  const gridTree = useMemo(
    () => (pastVersion ? historyGridTree(pastVersion) : tree),
    [pastVersion, tree],
  )
  const filledStageIds = useMemo(
    () => (pastVersion ? stageIdsFilledNow(pastVersion.diff) : undefined),
    [pastVersion],
  )
  const removedItemIds = useMemo(
    () => new Set(pastVersion?.diff.removed.map(({ id }) => id)),
    [pastVersion],
  )
  // The compact report keeps Lp from a desktop up, and j.m. one step wider.
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

  // Off `subtotals`, which counts the whole document rather than the visible rows, so a search
  // narrows the screen without changing what a section says it holds or what it is worth.
  const isReportCompact = report !== undefined && !report.isSummary
  // The worker's report scrolls as a page: his header scrolls away and the table header sticks,
  // instead of the grid scrolling under a pinned top.
  const pageScroll = report !== undefined
  // The client document keeps the row gate: it has no „Inwestycja" tab, and its toggle is `disabled`
  // on an empty kosztorys, so a panel left open would be a sheet of zeros nobody could fold away.
  const hasTotalsPanel = !worker && !pastVersion && (!preview || subtotals.length > 0)
  const [totalsOpen] = useTotalsPanelOpen(subtotals.length > 0)
  const [totalsFraction] = useTotalsPanelHeight()
  const gridHeightBesideTotals = hasTotalsPanel
    ? gridHeightBesidePanel(gridHeight, { open: totalsOpen, fraction: totalsFraction })
    : gridHeight
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
      // Built here so the bundle's identity is the memo's own — a fresh object per render would land
      // on every column's `columnData` and redraw the whole grid.
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

  const gridColumns = useMemo(
    () =>
      columns
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
    [columns, pastVersion, preview, columnTotals, totalLabel, sectionHeader, sectionFooter],
  )
  const engagedHiderList = engagedHiders(engagedConditionIds)
  const engagedDiagnostics = engagedConditionsOfKind(engagedConditionIds, 'diagnostic')
  const emptyByFilter = engagedHiderList.length > 0
  // Full-dataset rather than the rendered rows: `gridRows` always carries the spacer + „Razem" rows, and
  // a no-hit search empties `viewRows` over a kosztorys that is not in fact empty. The owner's
  // sekcja bez pozycji is content; the client's document never shows one. Under „Tylko zgłoszone” the
  // subtotals count only his reported rows, so an empty count is his report, not the document.
  const isEmpty = preview ? subtotals.length === 0 && !reportedOnly : sections.length === 0
  const bodyRows = useMemo(() => {
    const banded = buildSectionBandRows(viewRows, {
      enabled: sectionBandsVisible(sort),
      collapsedSectionIds,
      sections,
      showItemless,
    })
    // The compact report shows no money, so a „Razem" band would be an empty frame.
    return isReportCompact ? banded.filter((row) => !isSectionFooterRow(row.id)) : banded
  }, [viewRows, collapsedSectionIds, sort, sections, showItemless, isReportCompact])
  const gridRows = useMemo(() => [...bodyRows, makeSpacerRow(), makeTotalsRow()], [bodyRows])
  const datasheetRef = useRef<DataSheetGridRef>(null)
  const gridRowKeys = useMemo(() => gridRows.map((row) => String(row.id)), [gridRows])

  // The client's rows size themselves to their content: no drag handle, no way to open a truncated
  // text. The owner's stay at 32px until dragged, since an editor with every long
  // description expanded is unscannable. The measurement runs in both — in the editor it is what
  // „Dopasuj wysokość do treści" fits a row to.
  const measured = useMemo(() => measuredColumns(columns), [columns])
  // Keyed on the joined ids: `columns` is rebuilt on every edit, and a fresh array would tear down and
  // redo the width measurement each time.
  const measuredKey = measured.map((column) => column.id).join('|')
  const measuredIds = useMemo(() => measuredKey.split('|').filter(Boolean), [measuredKey])
  const wrap = useWrapColumnWidths(gridNode, measuredIds)
  // Cached per row because the row's height and every one of its cells' „…" read the same counts.
  const columnLinesFor = useMemo(() => {
    const measure = measureTextWidth(wrap.font)
    return memoisedByRow((row) => columnLines(row, measured, wrap.widths, measure))
  }, [wrap, measured])
  const contentLinesFor = useMemo(
    () => (row: KosztorysV2RowT) => rowContentLines(columnLinesFor(row)),
    [columnLinesFor],
  )
  // Both readings of „size me from the content" invalidate every cached height at once, not just the
  // rows below an inserted one — the owner's toggle included, since flipping it changes what every
  // row measures to without saying which rows changed.
  const sizeToContent = preview || fitRowsToContent
  // dsg offers no slot inside its scroller, so the footer is portaled into it. The grid is imported
  // statically, so its container is in the DOM by the time this sibling's ref fires.
  const [reportFooterAnchor, setReportFooterAnchor] = useState<HTMLElement | null>(null)
  const reportFooterHost =
    reportFooterAnchor?.parentElement?.querySelector<HTMLElement>('.dsg-container') ?? undefined
  useRowHeightCacheReset(datasheetRef, gridRowKeys, rowHeights, sizeToContent ? wrap : undefined)
  // The empty grid names what emptied it. The two kinds empty it for opposite reasons: an unticked
  // filter because EVERY pozycja fell into what was unticked, a diagnostic because NONE matched —
  // the goal state, worth saying out loud. The client's „ukryj puste pozycje" counts here too.
  const emptyCopy = emptyGridCopy({
    preview,
    hiders: engagedHiderList,
    diagnostics: engagedDiagnostics,
    dictionary: gridCopy,
  })
  // Absent in the preview: the client has no handle to drag.
  const rowResize: RowResizeApiT | undefined = useMemo(
    () => (preview ? undefined : { onGuide: setGuideY, onCommit: setRowHeight }),
    [preview, setGuideY, setRowHeight],
  )
  // Takes the row rather than its DOM: columns are virtualized horizontally, so „Opis prac" is
  // absent once scrolled past, and measuring the rendered row would fit it to one line.
  const fitRowToContent = useMemo(
    () =>
      preview
        ? undefined
        : (row: KosztorysV2RowT) =>
            setRowHeight(String(row.id), fitRowHeight(row.id, contentLinesFor(row))),
    [preview, setRowHeight, contentLinesFor],
  )
  const rowHeightFor = useMemo(
    () => (row: KosztorysV2RowT) =>
      resolveRowHeight({
        isSectionBand: isSectionHeaderRow(row.id),
        // The client's heights come from the content, full stop — the owner's drags live in the same
        // localStorage origin, so reading them here would let the owner's flattened editor rows clip
        // the offer they open to check.
        override: preview ? undefined : rowHeights[String(row.id)],
        contentLines: sizeToContent && !isSyntheticRow(row.id) ? contentLinesFor(row) : undefined,
      }),
    [preview, rowHeights, sizeToContent, contentLinesFor],
  )
  // Measured against the very height the grid gives the row, so the cue and the fit can't disagree.
  // No cue in the preview: its rows are sized from this measurement.
  const isClipped = useMemo(
    () =>
      (row: KosztorysV2RowT, columnId: string): boolean => {
        // A band's label deliberately overflows its own cell onto the empty ones beside it, so
        // measuring it against its column's width would flag every band as clipped.
        if (preview || isSyntheticRow(row.id)) return false
        const lines = columnLinesFor(row).get(columnId)
        return lines !== undefined && heightForLines(lines) > rowHeightFor(row)
      },
    [preview, columnLinesFor, rowHeightFor],
  )
  const gutterColumn = useMemo(
    () => ordinalGutterColumn({ ordinals: ordinalByRowId, resize: rowResize }),
    [ordinalByRowId, rowResize],
  )
  // A phone's compact report is Opis + „Zgłaszam” first; Lp would take width he needs.
  const hidesGutter = isReportCompact && !isWide
  // A sideways-scrolling report is wider than a phone, but dsg renders only the columns inside its own
  // box — so the box gets the columns' width up front. Not `max-content`: dsg answers a box that fits
  // with `width: 100%`, which collapses it again, and the two loop.
  const reportMinWidth =
    report && reportScrollsSideways(report)
      ? gridMinWidth(gridColumns, hidesGutter ? 0 : (gutterColumn.basis ?? 40))
      : undefined

  // Kosztorys client-view nets against the investment's transaction sums — net to net, since the
  // ledger carries no VAT. Through the same lib fn the investment page calls, so the two can't
  // disagree.
  const reconciliation = useMemo(
    () =>
      buildKosztorysReconciliation({
        laborCostsNetFromKosztorys,
        discountNetFromKosztorys,
        laborCostsNetFromTransactions,
        discountNetFromTransactions,
      }),
    [
      laborCostsNetFromKosztorys,
      discountNetFromKosztorys,
      laborCostsNetFromTransactions,
      discountNetFromTransactions,
    ],
  )

  return (
    <KosztorysEditorProvider
      editor={{
        ...editor,
        investmentId,
        investmentName,
        tree: gridTree,
        onOpenVersions: editor.readOnly ? undefined : onOpenVersions,
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
        {/* Mounted in the preview too: nothing there can open it, and a conditional wrapper would
            mean two copies of the whole body. */}
        <CataloguePickerHost>
          <NewItemHost>
            <ReorderHost>
              {/* The client view mounts under the bare (share) layout, which has no TopNav — subtracting
              its height there would leave a dead band, so the preview takes the whole viewport. */}
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
                  <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3 sm:px-5 sm:py-5">
                    <BrandLogo height={54} priority className="shrink-0 max-sm:h-11" />
                    {/* Its own row below `sm`, beside the logo from there up. Logo plus a `lg` button
                    leave a phone no width for a name, and the name is what the client is here to
                    read — so it takes the second line rather than an ellipsis. */}
                    <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                      <h1 className="truncate text-base font-medium">{investmentName}</h1>
                      {/* Its own line: appended to a long investment name it was the part the ellipsis
                      cut, and on the worker's document the name is what makes it his. */}
                      {worker && <p className="truncate text-sm font-medium">{worker.name}</p>}
                    </div>
                    <PreviewHeaderActions
                      history={investorHistory}
                      hasRows={subtotals.length > 0}
                      emptyRowCount={clientEmptyRowIds.size}
                      showAllRows={showAllRows}
                      onShowAllRowsChange={setShowAllRows}
                    />
                  </header>
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
                    {/* Without this the editor just looks broken — cells refuse focus and nothing says why.
                  Never under the preview: the client's document knows nothing of our statuses. */}
                    {lock && <KosztorysLockedBanner lock={lock} />}
                  </>
                )}
                {preview && <HistoryBanner version={pastVersion} />}
                {/* We measure the container height (flex-1) and pass it to the grid — datasheet-grid
            needs px for virtualization; without it, it renders all 1000 rows.
            The grid track `minmax(0,1fr)` gives a DEFINITE width (= viewport): the grid doesn't
            stretch the container to the sum of the columns, it scrolls them internally instead. */}
                <div
                  className={cn('relative flex min-h-0 flex-1', !pageScroll && 'overflow-hidden')}
                >
                  {/* min-w-0 lets the wrapper shrink below its content in a flex context;
              grid-cols-1 still gives the grid a definite width (anti-flicker). */}
                  <div
                    ref={gridRef}
                    className={cn(
                      'grid min-h-0 min-w-0 flex-1 grid-cols-1',
                      !pageScroll && 'overflow-hidden',
                    )}
                  >
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
                      // Strip the appended spacer + „Razem" rows before the editor's diff sees them — display-only.
                      onChange={(rows) => onChange(rows.filter((row) => !isSyntheticRow(row.id)))}
                      columns={gridColumns}
                      gutterColumn={hidesGutter ? false : gutterColumn}
                      height={gridHeightBesideTotals}
                      rowHeight={({ rowData }) => rowHeightFor(rowData)}
                      // Tall enough that verbose column labels („Pozostało netto (względem aktualizacji przedmiaru)" etc.)
                      // wrap onto two rows instead of truncating — and draggable from the same handle as a
                      // row, since which labels wrap depends on how wide the owner made their columns.
                      headerRowHeight={
                        report && !isWide
                          ? PHONE_REPORT_HEADER_HEIGHT
                          : resolveHeaderRowHeight(
                              preview ? undefined : rowHeights[HEADER_HEIGHT_KEY],
                            )
                      }
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
                  {/* Sized to the grid beside the panel, so a split panel can't cover the message and
              its button. */}
                  <div
                    className="pointer-events-none absolute inset-0 flex"
                    style={{ height: hasTotalsPanel ? gridHeightBesideTotals : undefined }}
                  >
                    {isEmpty && (
                      <EmptyState
                        title={
                          isTemplate
                            ? `${noun.Nominative} jest pusty`
                            : gridCopy.t('emptyKosztorys')
                        }
                        // The client view renders no toolbar, so it has no „Dodaj" menu to point at.
                        description={
                          preview ? undefined : 'Dodaj sekcję lub etap z menu „Dodaj" powyżej.'
                        }
                      >
                        {/* Typing a rozpiska by hand is the rarer of the two starts — the sheet already holds
                  it. Buried in „Opcje" it is the one moment nobody finds it. */}
                        {!editor.readOnly && hasSheet && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="pointer-events-auto"
                            onClick={openImport}
                          >
                            <SheetIcon />
                            Pobierz z arkusza Google…
                          </Button>
                        )}
                      </EmptyState>
                    )}
                    {/* The sibling state: rows exist, the search matched none of them. Gated on the search term
              rather than on `viewRows` alone so the „Wyczyść" advice can never be offered to someone
              who never typed anything. Unreachable in the client view, which renders no search field. */}
                    {!isEmpty && viewRows.length === 0 && search.trim() !== '' && (
                      <EmptyState
                        title={gridCopy.t('noResults')}
                        description={gridCopy.t('noResultsDescription', { query: search.trim() })}
                      >
                        {/* The overlay is click-through so the grid stays usable; the button opts back in. */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="pointer-events-auto"
                          onClick={() => setSearch('')}
                        >
                          {gridCopy.t('clearSearch')}
                        </Button>
                      </EmptyState>
                    )}
                    {/* A filter emptying itself is the goal state, not a dead end — nothing is left in the
              state it was looking for, so say that rather than leave a blank grid. Search takes
              precedence above: with both on, „nie pasuje do…" is the more specific explanation. */}
                    {/* Gated on the RECOGNISED conditions, not on the raw persisted set: an id left over from a
              condition a later release removed is a no-op for the grid, and counting it here would
              title the overlay „Brak pozycji " with nothing after it. */}
                    {!isEmpty &&
                      viewRows.length === 0 &&
                      search.trim() === '' &&
                      (emptyByFilter || engagedDiagnostics.length > 0) && (
                        <EmptyState title={emptyCopy.title} description={emptyCopy.description}>
                          {/* The client has no „Filtry" menu, so nothing there is theirs to reset. */}
                          {!preview && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="pointer-events-auto"
                              onClick={resetFilters}
                            >
                              Zresetuj filtry
                            </Button>
                          )}
                        </EmptyState>
                      )}
                  </div>
                  {/* Absolutely positioned: the grid's height is a measured px figure, never its
              container's, so the split is the grid passing `gridHeightBesideTotals`. For the owner it
              mounts whatever the row count, because „Inwestycja" has something to say on an empty
              kosztorys. */}
                  {hasTotalsPanel && (
                    <KosztorysTotalsPanel
                      hasRows={subtotals.length > 0}
                      availableHeight={gridHeight}
                      {...panelData}
                      investmentId={investmentId}
                      investmentName={investmentName}
                      investment={investment}
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
                {/* Vertical guide while dragging a column edge (left = cursor viewport X). Portaled to body:
            <main> uses transform-gpu, which would otherwise make this `fixed` element measure `left`
            from <main> (sidebar-offset) instead of the viewport — same containing-block trap as the
            context menu. */}
                {guideX !== null &&
                  createPortal(
                    <div
                      className="bg-primary/70 pointer-events-none fixed inset-y-0 z-50 w-px"
                      style={{ left: guideX }}
                    />,
                    document.body,
                  )}
                {/* Its horizontal twin, for a row-height drag — same portal, same reason. */}
                {guideY !== null &&
                  createPortal(
                    <div
                      className="bg-primary/70 pointer-events-none fixed inset-x-0 z-50 h-px"
                      style={{ top: guideY }}
                    />,
                    document.body,
                  )}
                {/* One instance for both triggers — the „Opcje" menu and the empty-kosztorys screen. */}
                {!preview && <SheetImportDialog {...importDialogProps} workers={editor.workers} />}
                {/* Rendered here, not next to the pickers: the same confirm stands in front of the inline
            controls in „Podsumowanie"/„Materiały" and of their twins in „Opcje rozliczenia". */}
                {!preview && <ConfirmDialog {...editor.investorImpactConfirm} />}
              </div>
            </ReorderHost>
          </NewItemHost>
        </CataloguePickerHost>
      </RowHeightFitProvider>
    </KosztorysEditorProvider>
  )
}
