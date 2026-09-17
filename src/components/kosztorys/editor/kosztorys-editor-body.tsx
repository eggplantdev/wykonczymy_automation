'use client'

import 'react-datasheet-grid/dist/style.css'
import { useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { SheetIcon } from 'lucide-react'
// `DynamicDataSheetGrid`, not `DataSheetGrid`: the library aliases the plain name to
// StaticDataSheetGrid, which snapshots `columns` via useState at mount (EX-422).
import { DynamicDataSheetGrid, type DataSheetGridRef } from 'react-datasheet-grid'
import { KosztorysTotalsPanel } from '@/components/kosztorys/summary/kosztorys-totals-panel'
import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'
import { KosztorysEditorToolbar } from '@/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar'
import { BrandLogo } from '@/components/ui/brand-logo'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useKosztorysEditor } from '@/components/kosztorys/editor/use-kosztorys-editor'
import { KosztorysEditorProvider } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { CataloguePickerHost } from '@/components/kosztorys/editor/actions/catalogue-picker-host'
import { useRowHeightCacheReset } from '@/components/kosztorys/editor/hooks/use-row-height-cache-reset'
import { useWrapColumnWidths } from '@/components/kosztorys/editor/hooks/use-wrap-column-widths'
import { useUndoKeyboard } from '@/components/kosztorys/editor/hooks/use-undo-keyboard'
import { useSheetImport } from '@/components/kosztorys/editor/hooks/use-sheet-import'
import { SheetImportDialog } from '@/components/kosztorys/editor/dialogs/sheet-import-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { sectionFooterLabelColumnId } from '@/components/kosztorys/editor/grid/cells/section-footer-cell'
import { sectionBandLabelColumnId } from '@/components/kosztorys/editor/grid/cells/section-header-cell'
import { withSyntheticRows } from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import {
  ordinalGutterColumn,
  type RowResizeApiT,
} from '@/components/kosztorys/editor/grid/ordinal-gutter-column'
import { buildSectionBandRows } from '@/lib/kosztorys/section-band-rows'
import { engagedConditionsOfKind, engagedHiders } from '@/lib/kosztorys/row-conditions/queries'
import { emptyGridCopy } from '@/lib/kosztorys/empty-grid-copy'
import {
  isSectionFooterRow,
  isSectionHeaderRow,
  isSyntheticRow,
  makeSpacerRow,
  makeTotalsRow,
} from '@/lib/kosztorys/synthetic-rows'
import {
  columnContentLines,
  rowContentLines,
  WRAPPING_COLUMN_IDS,
} from '@/lib/kosztorys/row-content-lines'
import {
  HEADER_HEIGHT_KEY,
  fitRowHeight,
  heightForLines,
  resolveHeaderRowHeight,
  resolveRowHeight,
} from '@/lib/kosztorys/row-height'
import { RowHeightFitProvider } from '@/components/kosztorys/editor/actions/row-height-fit-context'
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
import type { KosztorysEditorDataT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'

type PropsT = KosztorysEditorDataT & {
  // Read-only public render: hides the mutation chrome, kills persistence, gates the footer's
  // owner-only bits.
  preview?: boolean
  // Arrives with the preview payload only; the owner's editor renders the full grid regardless.
  clientView?: ClientViewSettingsT
  // Optional because the read-only client body omits it and falls back to NOOP_UNDO_REDO.
  undoRedo?: UndoRedoApiT
  onOpenVersions?: () => void
  onTreeReplaced?: () => void
  // Reseed after a write was refused because its row is gone (the tree was replaced elsewhere).
  onStaleTree?: () => Promise<void>
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
  locked = false,
  hasSheet = false,
  templatePresetId,
  undoRedo = NOOP_UNDO_REDO,
  onOpenVersions,
  onTreeReplaced,
  onStaleTree,
  workers,
  ...panelData
}: PropsT) {
  // A rozliczony wydatek means material was folded into robocizna, which is what makes a pozycja
  // priced off a coefficient hand the crew a cut of it (EX-708). The breakdown carries no link back
  // to a pozycja, so this is all the kosztorys can know.
  const hasSettledMaterial = panelData.settledBreakdown.length > 0
  const editor = useKosztorysEditor({
    investmentId,
    tree,
    preview,
    clientView,
    locked,
    undoRedo,
    workers,
    hasSettledMaterial,
    onStaleTree,
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
    resetFilters,
    ordinalByRowId,
    sectionRows,
    setSearch,
    collapsedSectionIds,
    toggleSectionCollapsed,
    onRenameSection,
    onInsertSection,
    onReorderSection,
    moveEdges,
    onSetSectionColor,
    onRemoveSection,
    onChange,
  } = editor

  useUndoKeyboard(editor.undo, editor.redo)

  const { openImport, importDialogProps } = useSheetImport({ investmentId, onTreeReplaced })

  // Off `subtotals`, which counts the whole document rather than the visible rows, so a search
  // narrows the screen without changing what a section says it holds or what it is worth.
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
        onInsertSection && onReorderSection && onSetSectionColor && onRemoveSection
          ? {
              onInsert: onInsertSection,
              onReorder: onReorderSection,
              onSetColor: onSetSectionColor,
              onRemove: onRemoveSection,
            }
          : undefined,
      sortActive: !orderCommandsEnabled(sort),
      moveEdges,
      labelColumnId: sectionBandLabelColumnId(columns.map((column) => column.id)),
    }),
    [
      subtotals,
      collapsedSectionIds,
      toggleSectionCollapsed,
      onRenameSection,
      onInsertSection,
      onReorderSection,
      onSetSectionColor,
      onRemoveSection,
      sort,
      moveEdges,
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
      columns.map((column) =>
        withSyntheticRows(column, {
          totals: columnTotals,
          sectionHeader,
          sectionFooter,
        }),
      ),
    [columns, columnTotals, sectionHeader, sectionFooter],
  )
  const engagedHiderList = engagedHiders(engagedConditionIds)
  const engagedDiagnostics = engagedConditionsOfKind(engagedConditionIds, 'diagnostic')
  const emptyByFilter = engagedHiderList.length > 0
  const bodyRows = useMemo(
    () =>
      buildSectionBandRows(viewRows, {
        enabled: sectionBandsVisible(sort),
        collapsedSectionIds,
        sections: sectionRows,
      }),
    [viewRows, collapsedSectionIds, sort, sectionRows],
  )
  const gridRows = useMemo(() => [...bodyRows, makeSpacerRow(), makeTotalsRow()], [bodyRows])
  const datasheetRef = useRef<DataSheetGridRef>(null)
  const gridRowKeys = useMemo(() => gridRows.map((row) => String(row.id)), [gridRows])

  // The client's rows size themselves to their „Opis prac": no drag handle, no way to open a
  // truncated description. The owner's stay at 32px until dragged, since an editor with every long
  // description expanded is unscannable. The measurement runs in both — in the editor it is what
  // „Dopasuj wysokość do treści" fits a row to.
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns])
  const wrap = useWrapColumnWidths(gridNode, columnIds)
  // Nothing worth caching twice: measureTextWidth caches every width it has measured, and dsg asks
  // for a row's height once per scroll that extends its measured range.
  const contentLinesFor = useMemo(() => {
    const measure = measureTextWidth(wrap.font)
    return (row: KosztorysV2RowT) => rowContentLines(row, wrap.widths, measure)
  }, [wrap])
  // Both readings of „size me from the content" invalidate every cached height at once, not just the
  // rows below an inserted one — the owner's toggle included, since flipping it changes what every
  // row measures to without saying which rows changed.
  const sizeToContent = preview || fitRowsToContent
  useRowHeightCacheReset(datasheetRef, gridRowKeys, rowHeights, sizeToContent ? wrap : undefined)
  // The empty grid names what emptied it. The two kinds empty it for opposite reasons: an unticked
  // filter because EVERY pozycja fell into what was unticked, a diagnostic because NONE matched —
  // the goal state, worth saying out loud. The client's „ukryj puste pozycje" counts here too.
  const emptyCopy = emptyGridCopy({
    preview,
    hiders: engagedHiderList,
    diagnostics: engagedDiagnostics,
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
  // One class per clipped column, so the „…" lands in the cell that is hiding something rather than
  // on the whole row. Measured from the same line count „Dopasuj wysokość do treści" uses, so the cue
  // and the fit can't disagree. No cue in the preview: its rows are sized from this measurement.
  const clipCueClass = useMemo(() => {
    const measure = measureTextWidth(wrap.font)
    return (row: KosztorysV2RowT) => {
      // A band's label deliberately overflows its own cell onto the empty ones beside it, so
      // measuring it against its column's width would flag every band as clipped.
      if (
        preview ||
        isSyntheticRow(row.id) ||
        isSectionHeaderRow(row.id) ||
        isSectionFooterRow(row.id)
      )
        return undefined
      const columnLines = WRAPPING_COLUMN_IDS.map((id) => ({
        id,
        lines: columnContentLines(row, id, wrap.widths, measure),
      }))
      const height = resolveRowHeight({
        isSectionBand: false,
        override: rowHeights[String(row.id)],
        contentLines: fitRowsToContent
          ? Math.max(...columnLines.map((column) => column.lines))
          : undefined,
      })
      return columnLines
        .filter((column) => heightForLines(column.lines) > height)
        .map((column) => `kosztorys-clipped-${column.id}`)
        .join(' ')
    }
  }, [preview, wrap, rowHeights, fitRowsToContent])
  const gutterColumn = useMemo(
    () => ordinalGutterColumn({ ordinals: ordinalByRowId, resize: rowResize }),
    [ordinalByRowId, rowResize],
  )

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
        tree,
        onOpenVersions: editor.readOnly ? undefined : onOpenVersions,
        onTreeReplaced,
        openImport: editor.readOnly ? undefined : openImport,
        hasSheet,
        templatePresetId,
      }}
    >
      {/* Wraps the body, not the grid: the value reaches a row's „…" through Radix's portal, which
          keeps the React tree even though the DOM leaves it. */}
      <RowHeightFitProvider fit={fitRowToContent}>
        {/* Mounted in the preview too: nothing there can open it, and a conditional wrapper would
            mean two copies of the whole body. */}
        <CataloguePickerHost>
          {/* The client view mounts under the bare (share) layout, which has no TopNav — subtracting
              its height there would leave a dead band, so the preview takes the whole viewport. */}
          <div
            className={cn(
              'flex w-full flex-col overflow-hidden',
              preview ? 'h-dvh' : 'h-below-top-nav',
            )}
          >
            {preview ? (
              <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-3 sm:px-5 sm:py-5">
                <BrandLogo height={54} priority className="shrink-0 max-sm:h-11" />
                {/* Its own row below `sm`, beside the logo from there up. Logo plus a `lg` button
                    leave a phone no width for a name, and the name is what the client is here to
                    read — so it takes the second line rather than an ellipsis. */}
                <h1 className="order-last w-full truncate text-base font-medium sm:order-none sm:w-auto sm:flex-1">
                  {investmentName}
                </h1>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {/* The panel's open state is persisted per person, not per view, so without this the
                  client view inherits whatever the toolbar last left and can never fold it back. */}
                  <KosztorysTotalsPanelToggle size="lg" disabled={subtotals.length === 0} />
                </div>
              </header>
            ) : (
              <>
                <KosztorysEditorToolbar />
                {/* Without this the editor just looks broken — cells refuse focus and nothing says why.
                  Never under the preview: the client's document knows nothing of our statuses. */}
                {locked && <KosztorysLockedBanner />}
              </>
            )}
            {/* We measure the container height (flex-1) and pass it to the grid — datasheet-grid
            needs px for virtualization; without it, it renders all 1000 rows.
            The grid track `minmax(0,1fr)` gives a DEFINITE width (= viewport): the grid doesn't
            stretch the container to the sum of the columns, it scrolls them internally instead. */}
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              {/* min-w-0 lets the wrapper shrink below its content in a flex context;
              grid-cols-1 still gives the grid a definite width (anti-flicker). */}
              <div
                ref={gridRef}
                className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden"
              >
                <DynamicDataSheetGrid
                  ref={datasheetRef}
                  className="kosztorys-grid"
                  value={gridRows}
                  // Strip the appended spacer + „Razem" rows before the editor's diff sees them — display-only.
                  onChange={(rows) => onChange(rows.filter((row) => !isSyntheticRow(row.id)))}
                  columns={gridColumns}
                  gutterColumn={gutterColumn}
                  height={gridHeight}
                  rowHeight={({ rowData }) =>
                    resolveRowHeight({
                      isSectionBand: isSectionHeaderRow(rowData.id),
                      // The client's heights come from the content, full stop — the owner's drags live
                      // in the same localStorage origin, so reading them here would let the owner's
                      // flattened editor rows clip the offer they open to check.
                      override: preview ? undefined : rowHeights[String(rowData.id)],
                      contentLines:
                        sizeToContent && !isSyntheticRow(rowData.id)
                          ? contentLinesFor(rowData)
                          : undefined,
                    })
                  }
                  // Tall enough that verbose column labels („Pozostało netto (względem przedmiaru)" etc.)
                  // wrap onto two rows instead of truncating — and draggable from the same handle as a
                  // row, since which labels wrap depends on how wide the owner made their columns.
                  headerRowHeight={resolveHeaderRowHeight(
                    preview ? undefined : rowHeights[HEADER_HEIGHT_KEY],
                  )}
                  lockRows
                  rowKey={({ rowData }) => String(rowData.id)}
                  rowClassName={({ rowData }) =>
                    cn(
                      sectionColorRail(rowData.sectionColor),
                      isSectionHeaderRow(rowData.id) && 'kosztorys-section-header',
                      isSectionFooterRow(rowData.id) && 'kosztorys-section-footer',
                      clipCueClass(rowData),
                    )
                  }
                />
              </div>
              {/* Emptiness is judged on `subtotals` (full-dataset) rather than the rendered rows:
              `gridRows` always carries the spacer + „Razem" rows, and a no-hit search empties
              `viewRows` over a kosztorys that is not in fact empty. */}
              {subtotals.length === 0 && (
                <EmptyState
                  className="pointer-events-none absolute inset-0"
                  title="Kosztorys jest pusty"
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
              {subtotals.length > 0 && viewRows.length === 0 && search.trim() !== '' && (
                <EmptyState
                  className="pointer-events-none absolute inset-0"
                  title="Brak wyników"
                  description={`Żadna pozycja nie pasuje do „${search.trim()}".`}
                >
                  {/* The overlay is click-through so the grid stays usable; the button opts back in. */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="pointer-events-auto"
                    onClick={() => setSearch('')}
                  >
                    Wyczyść wyszukiwanie
                  </Button>
                </EmptyState>
              )}
              {/* A filter emptying itself is the goal state, not a dead end — nothing is left in the
              state it was looking for, so say that rather than leave a blank grid. Search takes
              precedence above: with both on, „nie pasuje do…" is the more specific explanation. */}
              {/* Gated on the RECOGNISED conditions, not on the raw persisted set: an id left over from a
              condition a later release removed is a no-op for the grid, and counting it here would
              title the overlay „Brak pozycji " with nothing after it. */}
              {subtotals.length > 0 &&
                viewRows.length === 0 &&
                search.trim() === '' &&
                (emptyByFilter || engagedDiagnostics.length > 0) && (
                  <EmptyState
                    className="pointer-events-none absolute inset-0"
                    title={emptyCopy.title}
                    description={emptyCopy.description}
                  >
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
              {/* An opaque overlay over the WHOLE grid area, not a flex track: open, the summary takes the
              editor's screen and the grid keeps its full height underneath rather than being squeezed
              into what is left. Which is why it is not mounted over an empty kosztorys — the panel is
              open by default, its figures are all zeros there, and it would paint them over the only
              way in („Pobierz z arkusza Google…"), on exactly the first screen a new investment shows.
              The stored preference is untouched: it applies again the moment there are rows. */}
              {subtotals.length > 0 && (
                <KosztorysTotalsPanel
                  {...panelData}
                  investmentId={investmentId}
                  investmentName={investmentName}
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
                  showSettingsBar
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
            {!preview && <SheetImportDialog {...importDialogProps} />}
            {/* Rendered here, not next to the pickers: the same confirm stands in front of the inline
            controls in „Podsumowanie"/„Materiały" and of their twins in „Opcje rozliczenia". */}
            {!preview && <ConfirmDialog {...editor.investorImpactConfirm} />}
          </div>
        </CataloguePickerHost>
      </RowHeightFitProvider>
    </KosztorysEditorProvider>
  )
}
