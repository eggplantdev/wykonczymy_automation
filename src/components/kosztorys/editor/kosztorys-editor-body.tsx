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
import {
  engagedConditionsOfKind,
  engagedHiders,
  listLabels,
} from '@/lib/kosztorys/row-conditions/queries'
import {
  isSectionFooterRow,
  isSectionHeaderRow,
  isSyntheticRow,
  makeSpacerRow,
  makeTotalsRow,
} from '@/lib/kosztorys/synthetic-rows'
import { rowContentLines } from '@/lib/kosztorys/row-content-lines'
import {
  HEADER_HEIGHT_KEY,
  HEADER_ROW_HEIGHT,
  heightForLines,
  resolveRowHeight,
  restingRowHeight,
} from '@/lib/kosztorys/row-height'
import { measureTextWidth } from '@/lib/utils/text-measure'
import { sectionColorRail } from '@/lib/kosztorys/section-colors'
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
  // Read-only public/preview render: hides the mutation chrome, swaps the toolbar for a slim header,
  // kills persistence, and gates the footer's owner-only bits. The owner path leaves it unset.
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

// The stateful editor: seeds the grid from `tree` at mount (useKosztorysEditor's useState
// initializer). Remounting it (fresh `key` from the wrapper) is how a restore re-seeds the whole
// grid — see KosztorysEditorV2.
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
  undoRedo = NOOP_UNDO_REDO,
  onOpenVersions,
  onTreeReplaced,
  onStaleTree,
  workers,
  ...panelData
}: PropsT) {
  // Any rozliczony wydatek means some material was folded into robocizna, which is what makes a
  // pozycja priced off a coefficient hand the crew a cut of that material — the gate on EX-708's
  // guard. The breakdown carries no link back to a pozycja, so this is all the kosztorys can know.
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
    onChange,
  } = editor

  useUndoKeyboard(editor.undo, editor.redo)

  const { openImport, importDialogProps } = useSheetImport({ investmentId, onTreeReplaced })

  // Both figures come off `subtotals`, which counts the whole document rather than the visible rows,
  // so a search filter narrows what is on screen without changing what the section says it holds or
  // what it is worth. Under the client's preview the document itself is the shorter one.
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
      labelColumnId: sectionBandLabelColumnId(columns.map((column) => column.id)),
    }),
    [subtotals, collapsedSectionIds, toggleSectionCollapsed, onRenameSection, columns],
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
  const emptyByFilter = engagedHiders(engagedConditionIds).length > 0
  const bodyRows = useMemo(
    () =>
      buildSectionBandRows(viewRows, {
        enabled: sort?.scope !== 'global',
        collapsedSectionIds,
        sections: sectionRows,
      }),
    [viewRows, collapsedSectionIds, sort, sectionRows],
  )
  const gridRows = useMemo(() => [...bodyRows, makeSpacerRow(), makeTotalsRow()], [bodyRows])
  const datasheetRef = useRef<DataSheetGridRef>(null)
  const gridRowKeys = useMemo(() => gridRows.map((row) => String(row.id)), [gridRows])

  // The client's rows size themselves to their „Opis prac" — they have no handle to drag and no way
  // to open a truncated description, so a row that doesn't fit its text is simply unreadable. The
  // owner's rows do NOT: they stay at 32px until dragged, because an editor whose every long
  // description is expanded by default is unscannable. The measurement runs in both views all the
  // same — in the editor it is what a double-click on the handle fits a row to.
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns])
  const wrap = useWrapColumnWidths(gridNode, columnIds)
  // Re-wrapping the same description costs a handful of Map lookups: measureTextWidth caches every
  // width it has ever measured, and dsg only asks for a row's height once per scroll that extends
  // its measured range. So there is nothing here worth caching a second time.
  const contentLinesFor = useMemo(() => {
    const measure = measureTextWidth(wrap.font)
    return (row: KosztorysV2RowT) => rowContentLines(row, wrap.widths, measure)
  }, [wrap])
  // The override map and the measured widths both invalidate every cached height, not just those
  // below an inserted row.
  useRowHeightCacheReset(datasheetRef, gridRowKeys, rowHeights, preview ? wrap : undefined)
  // The empty grid names what emptied it — and the two kinds empty it for opposite reasons: an
  // unticked filter leaves nothing because EVERY pozycja fell into what was unticked, a diagnostic
  // because NONE matched it, which is the goal state and worth saying out loud rather than a dead end.
  // The client's own hider counts here too: with „ukryj puste pozycje" on and every pozycja empty,
  // the client would otherwise get a grid with nothing in it and no word about why.
  const engagedDiagnostics = engagedConditionsOfKind(engagedConditionIds, 'diagnostic')
  // One decision, not two: the title and the description always come from the same branch, so
  // splitting them into parallel ternaries only invites the two to drift apart.
  const emptyCopy = preview
    ? {
        title: 'Brak pozycji do pokazania',
        description: 'Żadna pozycja nie ma jeszcze przedmiaru ani wykonanej pracy.',
      }
    : emptyByFilter
      ? { title: 'Wszystkie pozycje schowane', description: undefined }
      : {
          title: `Brak pozycji ${listLabels(engagedDiagnostics, 'ani')}`,
          description: 'Filtr zrobił swoje — nie ma już czego poprawiać.',
        }
  // Composed here rather than in the editor hook because fitting a row to its text needs the
  // measured column widths, and only the rendered grid knows those. Absent in the preview: the
  // client has no handle to drag.
  const rowResize: RowResizeApiT | undefined = useMemo(
    () =>
      preview
        ? undefined
        : {
            onGuide: setGuideY,
            onCommit: setRowHeight,
            onFit: (row: KosztorysV2RowT) =>
              setRowHeight(
                String(row.id),
                Math.max(restingRowHeight(row.id), heightForLines(contentLinesFor(row))),
              ),
          },
    [preview, setGuideY, setRowHeight, contentLinesFor],
  )
  const gutterColumn = useMemo(
    () => ordinalGutterColumn({ ordinals: ordinalByRowId, resize: rowResize }),
    [ordinalByRowId, rowResize],
  )

  // Reconciliation verdict for the Podsumowanie scream: kosztorys client-view nets (laborCostsNetFromKosztorys /
  // discountNetFromKosztorys, view-independent) vs the investment's transaction sums — net to net, since the
  // ledger carries no VAT. Built via the shared lib fn — the same one the investment page calls — so
  // the two surfaces can't disagree.
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

  // Viewport minus the shell's chrome: the h-14 TopNav always, plus the h-14 AppFooter, which only
  // renders below `lg` (hence the two calcs — subtracting it at every width would leave a dead band
  // where no footer exists). The client view mounts under the bare (share) layout, which has neither,
  // so subtracting there is what WOULD leave the dead band — it takes the whole viewport.
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
      }}
    >
      {/* Mounted in the preview too — nothing there can open it, and a conditional wrapper would mean
          two copies of the whole body. */}
      <CataloguePickerHost>
        <div
          className={cn(
            'flex w-full flex-col overflow-hidden',
            preview ? 'h-dvh' : 'h-[calc(100dvh-7rem)] lg:h-[calc(100dvh-3.5rem)]',
          )}
        >
          {preview ? (
            <header className="flex items-center justify-between gap-2 border-b px-5 py-5">
              <div className="flex min-w-0 items-center gap-4">
                <BrandLogo height={54} priority className="shrink-0" />
                <h1 className="truncate text-base font-medium">{investmentName}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
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
            <div ref={gridRef} className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden">
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
                      preview && !isSyntheticRow(rowData.id) ? contentLinesFor(rowData) : undefined,
                  })
                }
                // Tall enough that verbose column labels („Pozostało netto (względem przedmiaru)" etc.)
                // wrap onto two rows instead of truncating — and draggable from the same handle as a
                // row, since which labels wrap depends on how wide the owner made their columns.
                headerRowHeight={
                  (preview ? undefined : rowHeights[HEADER_HEIGHT_KEY]) ?? HEADER_ROW_HEIGHT
                }
                lockRows
                rowKey={({ rowData }) => String(rowData.id)}
                rowClassName={({ rowData }) =>
                  cn(
                    sectionColorRail(rowData.sectionColor),
                    isSectionHeaderRow(rowData.id) && 'kosztorys-section-header',
                    isSectionFooterRow(rowData.id) && 'kosztorys-section-footer',
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
                description={preview ? undefined : 'Dodaj sekcję lub etap z menu „Dodaj" powyżej.'}
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
    </KosztorysEditorProvider>
  )
}
