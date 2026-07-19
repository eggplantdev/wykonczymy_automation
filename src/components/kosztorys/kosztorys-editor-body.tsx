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
  makeSpacerRow,
  makeTotalsRow,
  SPACER_ROW_ID,
  TOTALS_ROW_ID,
  withTotalsRow,
} from '@/components/kosztorys/kosztorys-totals-row'
import { toGross } from '@/lib/kosztorys/calc'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { stageKey, stageValueGrossKey, stageValueNetKey } from '@/lib/kosztorys/stage-keys'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'

type PropsT = {
  investmentId: number
  tree: KosztorysTreeT
  investmentName: string
  materialsNet: number
  materialyBreakdown: MaterialyBreakdownRowT[]
  wplatyNet: number
  zaliczkiByStage: Record<number, number>
  // Transaction-sourced robocizna/rabat (Σ LABOR_COST / Σ RABAT) — the reconciliation "actual" side.
  investmentRobocizna: number
  investmentRabat: number
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
  materialyBreakdown,
  wplatyNet,
  zaliczkiByStage,
  investmentRobocizna,
  investmentRabat,
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
    sumaPracNet,
    rabatClientNet,
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
  const gridRows = useMemo(() => [...viewRows, makeSpacerRow(), makeTotalsRow()], [viewRows])
  const isSyntheticRow = (id: number) => id === SPACER_ROW_ID || id === TOTALS_ROW_ID

  // Reconciliation verdict for the Podsumowanie scream: kosztorys client-view gross (sumaPracNet /
  // rabatClientNet, view-independent) vs the investment's transaction sums. Built via the shared lib
  // fn — the same one the investment page calls — so the two surfaces can't disagree.
  const reconciliation = useMemo(
    () =>
      buildKosztorysReconciliation({
        sumaPracNet,
        rabatClientNet,
        vatRate: tree.vatRate,
        investmentRobocizna,
        investmentRabat,
      }),
    [sumaPracNet, rabatClientNet, tree.vatRate, investmentRobocizna, investmentRabat],
  )

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
              // Strip the appended spacer + „Razem" rows before the editor's diff sees them — display-only.
              onChange={(rows) => onChange(rows.filter((row) => !isSyntheticRow(row.id)))}
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
            investmentId={investmentId}
            stages={stages}
            stageTotals={stageTotals}
            zaliczkiByStage={zaliczkiByStage}
            totalNet={totalNet}
            doZaplatyNet={doZaplatyNet}
            materialyNet={materialsNet}
            materialyBreakdown={materialyBreakdown}
            wplatyNet={wplatyNet}
            rabatAmount={rabatAmount}
            reconciliation={reconciliation}
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
