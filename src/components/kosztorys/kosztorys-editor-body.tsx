'use client'

import 'react-datasheet-grid/dist/style.css'
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
// `DynamicDataSheetGrid`, not `DataSheetGrid`: the library aliases the plain name to
// StaticDataSheetGrid, which snapshots `columns` via useState at mount (EX-422).
import { DynamicDataSheetGrid } from 'react-datasheet-grid'
import { KosztorysSectionSummary } from '@/components/kosztorys/kosztorys-section-summary'
import { KosztorysTotalsPanel } from '@/components/kosztorys/kosztorys-totals-panel'
import { KosztorysEditorToolbar } from '@/components/kosztorys/kosztorys-editor-toolbar'
import { useKosztorysEditor } from '@/components/kosztorys/use-kosztorys-editor'
import { KosztorysEditorProvider } from '@/components/kosztorys/use-kosztorys-editor-context'
import { useUndoKeyboard } from '@/components/kosztorys/use-undo-keyboard'
import {
  makeTotalsRow,
  TOTALS_ROW_ID,
  withTotalsRow,
} from '@/components/kosztorys/kosztorys-totals-row'
import { toGross } from '@/lib/kosztorys/calc'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
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
    stageQtyTotals,
    plannedQtyTotal,
    stages,
    totalNet,
    plannedNet,
    rabatAmount,
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

  // The „Razem" totals row is a real last grid row, so per-column sums stay aligned and scroll with
  // the grid for free. columnTotals bakes one sum per summable column id; withTotalsRow renders it.
  const columnTotals = useMemo(() => {
    const totals = new Map<string, number>()
    // Money: executed value + offered przedmiar, net and gross.
    totals.set('net', totalNet)
    totals.set('gross', toGross(totalNet, tree.vatRate))
    totals.set('plannedNet', plannedNet)
    totals.set('plannedGross', toGross(plannedNet, tree.vatRate))
    // Qty (Pomiar z natury): per-etap column, their sum, and the offered przedmiar column.
    let qtySum = 0
    for (const stage of stages) {
      const stageQty = stageQtyTotals.get(stage.id) ?? 0
      qtySum += stageQty
      totals.set(stageKey(stage.id), stageQty)
      const stageNet = stageTotals.get(stage.id) ?? 0
      totals.set(stageValueNetKey(stage.id), stageNet)
      totals.set(stageValueGrossKey(stage.id), toGross(stageNet, tree.vatRate))
    }
    totals.set('stageQtySum', qtySum)
    totals.set('plannedQty', plannedQtyTotal)
    return totals
  }, [stages, stageTotals, stageQtyTotals, plannedQtyTotal, totalNet, plannedNet, tree.vatRate])

  const gridColumns = useMemo(
    () => columns.map((column) => withTotalsRow(column, columnTotals)),
    [columns, columnTotals],
  )
  const gridRows = useMemo(() => [...viewRows, makeTotalsRow()], [viewRows])

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
              value={gridRows}
              // Strip the appended „Razem" row before the editor's diff sees it — it's display-only.
              onChange={(rows) => onChange(rows.filter((row) => row.id !== TOTALS_ROW_ID))}
              columns={gridColumns}
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
          {/* Overlays the grid's bottom edge instead of consuming a flex track — the grid keeps its
              full height and its last rows scroll under the (opaque) panel rather than being pushed up. */}
          <KosztorysTotalsPanel
            stages={stages}
            stageTotals={stageTotals}
            zaliczkiByStage={zaliczkiByStage}
            totalNet={totalNet}
            doZaplatyNet={doZaplatyNet}
            materialyNet={materialsNet}
            zaliczkiNet={stages.reduce((sum, stage) => sum + (zaliczkiByStage[stage.id] ?? 0), 0)}
            rabatAmount={rabatAmount}
            vatRate={tree.vatRate}
            moneyAxis={moneyAxis}
          />
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
      </div>
    </KosztorysEditorProvider>
  )
}
