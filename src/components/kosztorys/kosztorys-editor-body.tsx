'use client'

import 'react-datasheet-grid/dist/style.css'
import { createPortal } from 'react-dom'
// `DynamicDataSheetGrid`, not `DataSheetGrid`: the library aliases the plain name to
// StaticDataSheetGrid, which snapshots `columns` via useState at mount (EX-422).
import { DynamicDataSheetGrid } from 'react-datasheet-grid'
import { KosztorysSectionSummary } from '@/components/kosztorys/kosztorys-section-summary'
import { KosztorysPodsumowanie } from '@/components/kosztorys/kosztorys-podsumowanie'
import { KosztorysEtapTotals } from '@/components/kosztorys/kosztorys-etap-totals'
import { KosztorysTotalsBar } from '@/components/kosztorys/kosztorys-totals-bar'
import { KosztorysEditorToolbar } from '@/components/kosztorys/kosztorys-editor-toolbar'
import { useKosztorysEditor } from '@/components/kosztorys/use-kosztorys-editor'
import { KosztorysEditorProvider } from '@/components/kosztorys/use-kosztorys-editor-context'
import { useUndoKeyboard } from '@/components/kosztorys/use-undo-keyboard'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

type PropsT = {
  investmentId: number
  tree: KosztorysTreeT
  investmentName: string
  materialsNet: number
  zaliczkiByStage: Record<number, number>
  onOpenVersions: () => void
}

// The stateful editor: seeds the grid from `tree` at mount (useKosztorysEditor's useState
// initializer). Remounting it (fresh `key` from the wrapper) is how a restore re-seeds the whole
// grid — see KosztorysEditorV2.
export function KosztorysEditorBody({
  investmentId,
  tree,
  investmentName,
  materialsNet,
  zaliczkiByStage,
  onOpenVersions,
}: PropsT) {
  const editor = useKosztorysEditor({ investmentId, tree })
  const {
    gridRef,
    gridHeight,
    columns,
    viewRows,
    guideX,
    subtotals,
    stageTotals,
    stages,
    totalNet,
    discountAmount,
    doZaplatyNet,
    moneyAxis,
    sectionCoeffs,
    summaryOpen,
    setSummaryOpen,
    onChange,
    handleAddItem,
    handleAddSection,
    handleRenameSection,
    handleRemoveSection,
    handleSectionCoeffChange,
  } = editor

  useUndoKeyboard(editor.undo, editor.redo)

  // Viewport minus the shell's chrome: the h-14 TopNav always, plus the h-14 AppFooter, which only
  // renders below `lg` (hence the two calcs — subtracting it at every width would leave a dead band
  // where no footer exists).
  return (
    <KosztorysEditorProvider
      editor={{ ...editor, investmentId, investmentName, tree, onOpenVersions }}
    >
      <div className="flex h-[calc(100dvh-7rem)] w-full flex-col overflow-hidden lg:h-[calc(100dvh-3.5rem)]">
        <KosztorysEditorToolbar />
        {/* We measure the container height (flex-1) and pass it to the grid — datasheet-grid
            needs px for virtualization; without it, it renders all 1000 rows.
            The grid track `minmax(0,1fr)` gives a DEFINITE width (= viewport): the grid doesn't
            stretch the container to the sum of the columns, it scrolls them internally instead. */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {/* min-w-0 lets the wrapper shrink below its content in a flex context;
              grid-cols-1 still gives the grid a definite width (anti-flicker). */}
          <div ref={gridRef} className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden">
            <DynamicDataSheetGrid
              className="kosztorys-grid"
              value={viewRows}
              onChange={onChange}
              columns={columns}
              height={gridHeight}
              rowHeight={32}
              headerRowHeight={32}
              lockRows
              rowKey={({ rowData }) => String(rowData.id)}
            />
          </div>
          {summaryOpen && (
            <KosztorysSectionSummary
              subtotals={subtotals}
              globalCoeffs={tree.globalCoeffs}
              sectionCoeffs={sectionCoeffs}
              onClose={() => setSummaryOpen(false)}
              onAddSection={handleAddSection}
              onAddItem={handleAddItem}
              onRenameSection={handleRenameSection}
              onRemoveSection={handleRemoveSection}
              onSectionCoeffChange={handleSectionCoeffChange}
            />
          )}
        </div>
        <KosztorysEtapTotals
          stages={stages}
          stageTotals={stageTotals}
          zaliczkiByStage={zaliczkiByStage}
          wykonaneNet={totalNet}
          vatRate={tree.vatRate}
          moneyAxis={moneyAxis}
        />
        <KosztorysPodsumowanie
          robociznaNet={doZaplatyNet}
          materialyNet={materialsNet}
          vatRate={tree.vatRate}
          moneyAxis={moneyAxis}
        />
        <KosztorysTotalsBar
          discountAmount={discountAmount}
          doZaplatyNet={doZaplatyNet}
          vatRate={tree.vatRate}
          moneyAxis={moneyAxis}
        />
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
      </div>
    </KosztorysEditorProvider>
  )
}
