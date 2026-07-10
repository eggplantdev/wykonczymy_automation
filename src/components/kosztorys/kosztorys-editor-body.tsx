'use client'

import 'react-datasheet-grid/dist/style.css'
import { DataSheetGrid } from 'react-datasheet-grid'
import { KosztorysSectionSummary } from '@/components/kosztorys/kosztorys-section-summary'
import { KosztorysEditorToolbar } from '@/components/kosztorys/kosztorys-editor-toolbar'
import { useKosztorysEditor } from '@/components/kosztorys/use-kosztorys-editor'
import type { KosztorysTreeT } from '@/types/kosztorys'

type PropsT = {
  investmentId: number
  tree: KosztorysTreeT
  investmentName: string
  onOpenVersions: () => void
}

// The stateful editor: seeds the grid from `tree` at mount (useKosztorysEditor's useState
// initializer). Remounting it (fresh `key` from the wrapper) is how a restore re-seeds the whole
// grid — see KosztorysEditorV2.
export function KosztorysEditorBody({
  investmentId,
  tree,
  investmentName,
  onOpenVersions,
}: PropsT) {
  const {
    gridRef,
    gridHeight,
    columns,
    viewRows,
    view,
    sort,
    widthsKey,
    stagesKey,
    guideX,
    subtotals,
    totalNet,
    sectionCoeffs,
    setView,
    bruttoVisible,
    toggleBrutto,
    search,
    setSearch,
    activeSectionId,
    setActiveSectionId,
    summaryOpen,
    setSummaryOpen,
    onChange,
    handleAddItem,
    handleAddSection,
    handleAddStage,
    handleRenameSection,
    handleRemoveSection,
    isSectionPopulated,
    handleGlobalCoeffChange,
    handleSectionCoeffChange,
    handleVatChange,
  } = useKosztorysEditor({ investmentId, tree })

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full flex-col overflow-hidden">
      <KosztorysEditorToolbar
        investmentId={investmentId}
        investmentName={investmentName}
        onOpenVersions={onOpenVersions}
        view={view}
        onViewChange={setView}
        search={search}
        onSearchChange={setSearch}
        activeSectionId={activeSectionId}
        onAddItem={handleAddItem}
        onAddStage={handleAddStage}
        itemCount={viewRows.length}
        bruttoVisible={bruttoVisible}
        onToggleBrutto={toggleBrutto}
        summaryOpen={summaryOpen}
        onToggleSummary={() => setSummaryOpen((o) => !o)}
      />
      {/* We measure the container height (flex-1) and pass it to the grid — datasheet-grid
          needs px for virtualization; without it, it renders all 1000 rows.
          The grid track `minmax(0,1fr)` gives a DEFINITE width (= viewport): the grid doesn't
          stretch the container to the sum of the columns, it scrolls them internally instead. */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* min-w-0 lets the wrapper shrink below its content in a flex context;
            grid-cols-[minmax(0,1fr)] still gives the grid a definite width (anti-flicker). */}
        <div
          ref={gridRef}
          className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden"
        >
          <DataSheetGrid
            // Remount on a change of view / widths / entering sort: dsg freezes `columns`
            // at mount and picks up no change to their definition without a remount — without `view`
            // all 3 views showed the client price, without `widthsKey` a resize didn't recompute the widths.
            // `sorted/natural`: the reorder arrows (grayed out while sorting) must rebuild
            // on entering/leaving sort — asc↔desc does not remount (arrow state unchanged).
            key={`${view}:${sort ? 'sorted' : 'natural'}:${widthsKey}:${stagesKey}:${bruttoVisible}`}
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
            grandNet={totalNet}
            activeSectionId={activeSectionId}
            globalCoeffs={tree.globalCoeffs}
            sectionCoeffs={sectionCoeffs}
            vatRate={tree.vatRate}
            bruttoVisible={bruttoVisible}
            onClose={() => setSummaryOpen(false)}
            onAddSection={handleAddSection}
            onAddItem={handleAddItem}
            onRenameSection={handleRenameSection}
            onRemoveSection={handleRemoveSection}
            isSectionPopulated={isSectionPopulated}
            onFilterSection={setActiveSectionId}
            onGlobalCoeffChange={handleGlobalCoeffChange}
            onSectionCoeffChange={handleSectionCoeffChange}
            onVatChange={handleVatChange}
          />
        )}
      </div>
      {/* Vertical guide while dragging a column edge (fixed = cursor X). */}
      {guideX !== null && (
        <div
          className="bg-primary/70 pointer-events-none fixed inset-y-0 z-50 w-px"
          style={{ left: guideX }}
        />
      )}
    </div>
  )
}
