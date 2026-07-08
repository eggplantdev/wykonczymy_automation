'use client'

import 'react-datasheet-grid/dist/style.css'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataSheetGrid } from 'react-datasheet-grid'
import { useDebouncedSave } from '@/components/kosztorys/use-debounced-save'
import { useColumnWidths } from '@/components/kosztorys/use-column-widths'
import { KosztorysSectionSummary } from '@/components/kosztorys/kosztorys-section-summary'
import { useElementHeight } from '@/hooks/use-element-height'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buildV2Columns } from '@/lib/tables/kosztorys-v2-columns'
import {
  applyAddItem,
  applyRemoveItem,
  buildBlankRow,
  diffRow,
  filterRows,
  NEW_SECTION_DEFAULTS,
  revertField,
  sectionItemCount,
  sectionNeighbor,
  sortRows,
  swapItemInSection,
  treeToRows,
  type SortDirT,
} from '@/lib/kosztorys/v2-rows'
import {
  rowNetForView,
  sectionSubtotalsForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import {
  addItemAction,
  addSectionAction,
  removeItemAction,
  removeSectionAction,
  swapItemOrderAction,
  updateInvestmentCoeffsAction,
  updateItemFieldAction,
  updateSectionFieldAction,
} from '@/lib/actions/kosztorys'
import type { ItemPatchT, KosztorysTreeT, KosztorysV2RowT } from '@/types/kosztorys'

type PropsT = { investmentId: number; tree: KosztorysTreeT; investmentName: string }

// Three views over one dataset: they only change the active price and its derived values.
const VIEWS: { value: PriceViewT; label: string }[] = [
  { value: 'client', label: 'Robocizna' },
  { value: 'w_tools', label: 'Z narzędziami' },
  { value: 'own_tools', label: 'Bez narzędzi' },
]

type SortStateT = { field: string; dir: SortDirT } | null

// Value to sort by for a given field — derived (price/net) according to the view.
function sortValue(row: KosztorysV2RowT, field: string, view: PriceViewT): string | number {
  switch (field) {
    case 'price':
      return viewPrice(row, view)
    case 'net':
      return rowNetForView(row, view)
    default: {
      const v = row[field as keyof KosztorysV2RowT]
      return (typeof v === 'number' ? v : (v ?? '')) as string | number
    }
  }
}

export function KosztorysEditorV2({ investmentId, tree, investmentName }: PropsT) {
  const router = useRouter()
  const save = useDebouncedSave(500)
  const [gridRef, gridHeight] = useElementHeight()
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() => treeToRows(tree))
  const [view, setView] = useState<PriceViewT>('client')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortStateT>(null)
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(true)
  // Column widths: persisted in localStorage. Commit (on handle release) saves and, via
  // `key`, remounts the grid with the new width — react-datasheet-grid does not recompute
  // sizing without a remount (its internal memo). During the drag we only show a vertical
  // guide (guideX = cursor X), without touching the grid.
  const { widths, setWidth } = useColumnWidths()
  const [guideX, setGuideX] = useState<number | null>(null)
  // Snapshot of the previous rows for diffing (keyed by item id) — the full dataset, not the view.
  // It also serves as the "fresh dataset" read by structural event handlers (section count):
  // kept in sync on every add/remove/edit, so no separate ref for rows is needed.
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))
  // "Latest value" ref: the fresh `rows` (display order) read during an event-time reorder.
  // The dsg column closure is frozen at mount, so the render's `rows` can be stale, and firing
  // an action inside the setRows updater would update the Router during render (a React error).
  // Writing a ref during render is the well-known, safe "latest value" pattern — the rule is too strict.
  const rowsRef = useRef(rows)
  // eslint-disable-next-line react-hooks/refs
  rowsRef.current = rows

  function toggleSort(field: string) {
    setSort((prev) => {
      if (prev?.field !== field) return { field, dir: 'asc' }
      if (prev.dir === 'asc') return { field, dir: 'desc' }
      return null
    })
  }

  // onRemoveItem/onReorderItem read prevById.current / rowsRef.current — stable refs —
  // only from a cell's onClick, never during render, so passing them here is safe.
  const columns = buildV2Columns({
    view,
    sort,
    onToggleSort: toggleSort,
    widths,
    onGuide: setGuideX,
    onCommitColumn: setWidth,
    onRemoveItem: handleRemoveItem,
    onReorderItem: handleReorderItem,
  })
  // Signature that forces a grid remount: dsg freezes `columns` at mount, so EVERY
  // dimension that shapes the columns must be in the key — the active view, entering/leaving
  // sort (reorder arrows), AND the widths. asc↔desc does NOT remount (arrow state unchanged).
  // See the lesson in lessons.md.
  const widthsKey = JSON.stringify(widths)

  // View = filter + sort. Edits are mapped back into the full dataset by id.
  const viewRows = useMemo(() => {
    const scoped =
      activeSectionId == null ? rows : rows.filter((r) => r.sectionId === activeSectionId)
    const filtered = filterRows(scoped, search)
    if (!sort) return filtered
    return sortRows(filtered, (r) => sortValue(r, sort.field, view), sort.dir)
  }, [rows, activeSectionId, search, sort, view])

  // Per-section subtotals: the FULL dataset (not viewRows) — a stable breakdown independent of
  // the filter/sort.
  const subtotals = useMemo(() => sectionSubtotalsForView(rows, view), [rows, view])
  const totalNet = useMemo(() => subtotals.reduce((s, x) => s + x.net, 0), [subtotals])

  // revert-on-error: roll an optimistic field edit back to its pre-save value
  // (rows + diff snapshot) when the server rejects it. The "current === attempted" guard lives
  // in revertField — we don't stomp on a newer edit.
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

  async function handleAddItem(sectionId: number) {
    const res = await addItemAction(investmentId, sectionId)
    if (!res.success) return
    // Take the denormalized section fields from any existing row of that section.
    const sample = [...prevById.current.values()].find((r) => r.sectionId === sectionId)
    const row = buildBlankRow({
      id: res.data.id,
      displayOrder: res.data.displayOrder,
      sectionId,
      sectionName: sample?.sectionName ?? NEW_SECTION_DEFAULTS.name,
      vatRate: tree.vatRate,
      sectionDefaultCostVariant:
        sample?.sectionDefaultCostVariant ?? NEW_SECTION_DEFAULTS.defaultCostVariant,
      sectionWToolsCoeff: sample?.sectionWToolsCoeff ?? null,
      sectionOwnToolsCoeff: sample?.sectionOwnToolsCoeff ?? null,
      globalWToolsCoeff: tree.globalCoeffs.wTools,
      globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
      stages: [],
    })
    prevById.current.set(row.id, row)
    setRows((rs) => applyAddItem(rs, row))
  }

  function handleRemoveItem(row: KosztorysV2RowT) {
    // Invariant: a section has ≥1 item. Count from prevById (fresh dataset, event-time read —
    // dsg columns are frozen at mount, so we enforce the rule here, not via a visual disabled state).
    if (sectionItemCount([...prevById.current.values()], row.sectionId) <= 1) {
      window.alert(
        'Sekcja musi mieć co najmniej jedną pozycję. Aby ją usunąć, użyj kosza sekcji w panelu.',
      )
      return
    }
    prevById.current.delete(row.id)
    setRows((rs) => applyRemoveItem(rs, row.id))
    void removeItemAction(row.id)
  }

  function handleReorderItem(row: KosztorysV2RowT, dir: 'up' | 'down') {
    const rs = rowsRef.current
    const neighbor = sectionNeighbor(rs, row.id, dir)
    if (!neighbor) return // edge of the block → no-op
    setRows(swapItemInSection(rs, row.id, dir))
    // ▲▼ is a swap of two neighbors → we only exchange their display_order (2 updates, not a
    // renumbering of the whole section — that choked with 1000+ rows). The action fires from the
    // event handler, not from the setRows updater (there its cache revalidation would move the Router during render).
    void swapItemOrderAction(
      { id: row.id, displayOrder: neighbor.displayOrder },
      { id: neighbor.id, displayOrder: row.displayOrder },
    )
  }

  async function handleAddSection() {
    const sec = await addSectionAction(investmentId)
    if (!sec.success) return
    // A new section immediately gets a blank item (an empty section = 0 rows = invisible).
    const item = await addItemAction(investmentId, sec.data.id)
    if (!item.success) return
    const row = buildBlankRow({
      id: item.data.id,
      displayOrder: item.data.displayOrder,
      sectionId: sec.data.id,
      sectionName: NEW_SECTION_DEFAULTS.name,
      vatRate: tree.vatRate,
      sectionDefaultCostVariant: NEW_SECTION_DEFAULTS.defaultCostVariant,
      sectionWToolsCoeff: null,
      sectionOwnToolsCoeff: null,
      globalWToolsCoeff: tree.globalCoeffs.wTools,
      globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
      stages: [],
    })
    prevById.current.set(row.id, row)
    setRows((rs) => applyAddItem(rs, row))
  }

  function handleRemoveSection(sectionId: number) {
    setRows((rs) => rs.filter((r) => r.sectionId !== sectionId))
    for (const [id, r] of prevById.current) {
      if (r.sectionId === sectionId) prevById.current.delete(id)
    }
    if (activeSectionId === sectionId) setActiveSectionId(null)
    void removeSectionAction(sectionId)
  }

  function handleRenameSection(sectionId: number, name: string) {
    // The name is denormalized on every row of the section — overwrite them all locally.
    setRows((rs) => rs.map((r) => (r.sectionId === sectionId ? { ...r, sectionName: name } : r)))
    for (const [id, r] of prevById.current) {
      if (r.sectionId === sectionId) prevById.current.set(id, { ...r, sectionName: name })
    }
    void updateSectionFieldAction(sectionId, { name })
  }

  // Section coefficients (null = inherits the global) for the panel — from the tree, keyed by section id.
  const sectionCoeffs = new Map(
    tree.sections.map((s) => [s.id, { wTools: s.wToolsCoeff, ownTools: s.ownToolsCoeff }]),
  )

  // Optimistic patch of a denormalized field on the matching rows + prevById (like
  // handleRenameSection for sectionName). The markup coefficients are denormalized on
  // EVERY row, but they are changed OUTSIDE the grid (the panel). router.refresh() alone won't
  // pick them up: `rows` lives in useState with an initializer that runs once at mount, so a
  // refreshed `tree` prop does not reinitialize the rows — without this patch the "Cena" column
  // would show the stale value until a reload.
  function patchRows(
    match: (row: KosztorysV2RowT) => boolean,
    patch: (row: KosztorysV2RowT) => KosztorysV2RowT,
  ) {
    setRows((rs) => rs.map((r) => (match(r) ? patch(r) : r)))
    for (const [id, r] of prevById.current) {
      if (match(r)) prevById.current.set(id, patch(r))
    }
  }

  // Changing the global coefficient recomputes the derived prices of all non-overridden
  // items. Optimistic patch on the rows + a refresh for the panel (which reads from `tree`).
  async function handleGlobalCoeffChange(patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) {
    patchRows(
      () => true,
      (r) => ({
        ...r,
        ...(patch.wToolsCoeff != null ? { globalWToolsCoeff: patch.wToolsCoeff } : {}),
        ...(patch.ownToolsCoeff != null ? { globalOwnToolsCoeff: patch.ownToolsCoeff } : {}),
      }),
    )
    const res = await updateInvestmentCoeffsAction(investmentId, patch)
    if (res.success) router.refresh()
  }

  // Section coefficient (null = inherits the global) — patch only the rows of that section.
  async function handleSectionCoeffChange(
    sectionId: number,
    patch: { wToolsCoeff?: number | null; ownToolsCoeff?: number | null },
  ) {
    patchRows(
      (r) => r.sectionId === sectionId,
      (r) => ({
        ...r,
        ...('wToolsCoeff' in patch ? { sectionWToolsCoeff: patch.wToolsCoeff ?? null } : {}),
        ...('ownToolsCoeff' in patch ? { sectionOwnToolsCoeff: patch.ownToolsCoeff ?? null } : {}),
      }),
    )
    const res = await updateSectionFieldAction(sectionId, patch)
    if (res.success) router.refresh()
  }

  function onChange(next: KosztorysV2RowT[]) {
    const changedById = new Map<number, KosztorysV2RowT>()
    for (const row of next) {
      const prev = prevById.current.get(row.id)
      if (!prev) continue
      const diff = diffRow(prev, row)
      if (diff.itemPatch) {
        const patch = diff.itemPatch
        for (const field of Object.keys(patch)) {
          const key = field as keyof KosztorysV2RowT
          const prevVal = prev[key]
          const attempted = row[key]
          save(
            `item:${row.id}:${field}`,
            () => updateItemFieldAction(row.id, { [field]: patch[field as keyof ItemPatchT] }),
            () => revertOne(row.id, key, prevVal, attempted),
          )
        }
        changedById.set(row.id, row)
      }
      prevById.current.set(row.id, row)
    }
    if (changedById.size > 0) {
      // Merge the view's changes into the full dataset by id (so filter/sort don't lose hidden rows).
      setRows((master) => master.map((r) => changedById.get(r.id) ?? r))
      // Pull the recomputed totals from the server after the save quiets down (only when
      // something actually changed — an unconditional refresh on a spurious onChange could loop the render).
      setTimeout(() => router.refresh(), 700)
    }
  }

  return (
    // Full-height page like a spreadsheet view: a compact bar on top + the grid taking the rest.
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="border-border flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
        <h1 className="text-foreground text-sm font-medium">Kosztorys — {investmentName}</h1>
        <div className="flex items-center gap-1">
          {VIEWS.map((v) => (
            <Button
              key={v.value}
              size="sm"
              variant={v.value === view ? 'default' : 'outline'}
              onClick={() => setView(v.value)}
            >
              {v.label}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Szukaj pozycji / sekcji…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs"
        />
        {activeSectionId != null && (
          <Button size="sm" variant="outline" onClick={() => handleAddItem(activeSectionId)}>
            ＋ pozycja
          </Button>
        )}
        <span className="text-muted-foreground text-sm">{viewRows.length} pozycji</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={summaryOpen ? 'default' : 'outline'}
            onClick={() => setSummaryOpen((o) => !o)}
          >
            Sekcje
          </Button>
        </div>
      </div>
      {/* We measure the container height (flex-1) and pass it to the grid — datasheet-grid
          needs px for virtualization; without it, it renders all 1000 rows.
          The grid track `minmax(0,1fr)` gives a DEFINITE width (= viewport): the grid doesn't
          stretch the container to the sum of the columns, it scrolls them internally instead. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
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
            key={`${view}:${sort ? 'sorted' : 'natural'}:${widthsKey}`}
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
            onClose={() => setSummaryOpen(false)}
            onAddSection={handleAddSection}
            onAddItem={handleAddItem}
            onRenameSection={handleRenameSection}
            onRemoveSection={handleRemoveSection}
            onFilterSection={setActiveSectionId}
            onGlobalCoeffChange={handleGlobalCoeffChange}
            onSectionCoeffChange={handleSectionCoeffChange}
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
