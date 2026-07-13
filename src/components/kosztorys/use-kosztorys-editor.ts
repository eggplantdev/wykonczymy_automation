'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDebouncedSave } from '@/components/kosztorys/use-debounced-save'
import { useColumnWidths } from '@/components/kosztorys/use-column-widths'
import { usePriceView } from '@/components/kosztorys/use-price-view'
import { useElementHeight } from '@/hooks/use-element-height'
import { toastMessage } from '@/lib/utils/toast'
import { buildV2Columns, type V2SortStateT } from '@/lib/tables/kosztorys-v2-columns'
import {
  applyAddItem,
  applyInsertItem,
  applyRemoveItem,
  buildBlankRow,
  diffRow,
  filterRows,
  insertDisplayOrder,
  isRowPopulated,
  isSectionPopulated,
  revertField,
  rowDoneNetForView,
  sectionItemCount,
  sectionNeighbor,
  sortRows,
  stageKey,
  swapItemInSection,
  treeToRows,
  type SortDirT,
} from '@/lib/kosztorys/v2-rows'
import { NEW_SECTION_DEFAULTS } from '@/lib/kosztorys/constants'
import {
  rowNetForView,
  rowRemainingForView,
  sectionSubtotalsForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import {
  addItemAction,
  addSectionAction,
  addStageAction,
  insertItemAction,
  removeItemAction,
  removeSectionAction,
  removeStageAction,
  setStageProgressAction,
  swapItemOrderAction,
  updateInvestmentCoeffsAction,
  updateInvestmentVatAction,
  updateItemFieldAction,
  updateSectionFieldAction,
  updateStageFieldAction,
} from '@/lib/actions/kosztorys'
import type {
  ItemPatchT,
  KosztorysStageT,
  KosztorysTreeT,
  KosztorysV2RowT,
} from '@/types/kosztorys'

type ArgsT = { investmentId: number; tree: KosztorysTreeT }

function sortValue(
  row: KosztorysV2RowT,
  field: string,
  view: PriceViewT,
  stages: KosztorysStageT[],
): string | number {
  switch (field) {
    case 'price':
      return viewPrice(row, view)
    case 'net':
      return rowNetForView(row, view)
    case 'remaining':
      return rowRemainingForView(row, rowDoneNetForView(row, stages, view), view)
    default: {
      const v = row[field as keyof KosztorysV2RowT]
      return (typeof v === 'number' ? v : (v ?? '')) as string | number
    }
  }
}

// All editor state, derived data, and handlers for the in-app kosztorys grid. Kept out of the
// component so the component is only composition + markup. The dsg constraints live here: the
// grid freezes `columns` at mount, so handlers read fresh state through refs (prevById / rowsRef)
// and never fire an action from inside a setRows updater (that would move the Router during render).
export function useKosztorysEditor({ investmentId, tree }: ArgsT) {
  const router = useRouter()
  const save = useDebouncedSave(500)
  const [gridRef, gridHeight] = useElementHeight()
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() => treeToRows(tree))
  // Stages live in local state (like `rows`): add/remove optimistically add/drop a column, and
  // `stagesKey` feeds the grid remount key (dsg freezes columns at mount).
  const [stages, setStages] = useState<KosztorysStageT[]>(tree.stages)
  const [view, setView] = usePriceView(investmentId)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<V2SortStateT>(null)
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
  // Same "latest value" ref for stages — the rename handler lives in the mount-frozen column
  // closure, so its no-op guard must compare against the fresh label, not the mount snapshot.
  const stagesRef = useRef(stages)
  // eslint-disable-next-line react-hooks/refs
  stagesRef.current = stages

  function setSortField(field: string, dir: SortDirT | null) {
    setSort(dir ? { field, dir } : null)
  }

  // onRemoveItem/onReorderItem read prevById.current / rowsRef.current — stable refs —
  // only from a cell's onClick, never during render, so passing them here is safe.
  const columns = buildV2Columns({
    view,
    stages,
    onRemoveStage: handleRemoveStage,
    onRenameStage: handleRenameStage,
    sort,
    onSetSort: setSortField,
    widths,
    onGuide: setGuideX,
    onCommitColumn: setWidth,
    onRemoveItem: handleRemoveItem,
    onReorderItem: handleReorderItem,
    onInsertItem: handleInsertItem,
    // Disables the trash button on a section's last item; the toast in handleRemoveItem stays as
    // a defensive backstop. Same fresh-ref, event-time read as the handlers above.
    getSectionItemCount,
  })
  const widthsKey = JSON.stringify(widths)
  const stagesKey = stages.map((s) => s.id).join(',')

  // View = filter + sort. Edits are mapped back into the full dataset by id.
  const viewRows = useMemo(() => {
    const scoped =
      activeSectionId == null ? rows : rows.filter((r) => r.sectionId === activeSectionId)
    const filtered = filterRows(scoped, search)
    if (!sort) return filtered
    return sortRows(filtered, (r) => sortValue(r, sort.field, view, stages), sort.dir)
  }, [rows, activeSectionId, search, sort, view, stages])

  // Per-section subtotals: the FULL dataset (not viewRows) — a stable breakdown independent of
  // the filter/sort.
  const subtotals = useMemo(() => sectionSubtotalsForView(rows, view), [rows, view])
  const totalNet = useMemo(() => subtotals.reduce((s, x) => s + x.net, 0), [subtotals])

  // Section coefficients (null = inherits the global) for the panel — from the tree, keyed by section id.
  const sectionCoeffs = new Map(
    tree.sections.map((s) => [s.id, { wTools: s.wToolsCoeff, ownTools: s.ownToolsCoeff }]),
  )

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
      stages,
    })
    prevById.current.set(row.id, row)
    setRows((rs) => applyAddItem(rs, row))
  }

  // ⋯ menu → Wstaw pozycję powyżej/poniżej. Inserts a blank row at the anchor's display slot
  // (±1) within the anchor's section. "Above/below" has no meaning against a price-sorted view, so
  // it's a no-op while a column sort is active (the menu also disables it). Denormalized section
  // fields come from any existing row of that section (as in handleAddItem).
  async function handleInsertItem(anchorRow: KosztorysV2RowT, dir: 'above' | 'below') {
    if (sort) return
    const at = insertDisplayOrder(anchorRow, dir)
    const res = await insertItemAction(investmentId, anchorRow.sectionId, at)
    if (!res.success) return
    const sample =
      [...prevById.current.values()].find((r) => r.sectionId === anchorRow.sectionId) ?? anchorRow
    const row = buildBlankRow({
      id: res.data.id,
      displayOrder: res.data.displayOrder,
      sectionId: anchorRow.sectionId,
      sectionName: sample.sectionName,
      vatRate: tree.vatRate,
      sectionDefaultCostVariant: sample.sectionDefaultCostVariant,
      sectionWToolsCoeff: sample.sectionWToolsCoeff,
      sectionOwnToolsCoeff: sample.sectionOwnToolsCoeff,
      globalWToolsCoeff: tree.globalCoeffs.wTools,
      globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
      stages,
    })
    // Mirror the section-tail display_order bump in prevById so a later insert/▲▼ diffs correctly.
    for (const [id, r] of prevById.current) {
      if (r.sectionId === row.sectionId && r.displayOrder >= at) {
        prevById.current.set(id, { ...r, displayOrder: r.displayOrder + 1 })
      }
    }
    prevById.current.set(row.id, row)
    setRows((rs) => applyInsertItem(rs, anchorRow.id, row, dir))
  }

  // Fresh count of a section's items, read from prevById (the full dataset) at cell-render time.
  function getSectionItemCount(sectionId: number) {
    return sectionItemCount([...prevById.current.values()], sectionId)
  }

  async function handleRemoveItem(row: KosztorysV2RowT) {
    // Invariant: a section has ≥1 item. Count from prevById (fresh dataset, event-time read —
    // dsg columns are frozen at mount, so we enforce the rule here, not via a visual disabled state).
    if (sectionItemCount([...prevById.current.values()], row.sectionId) <= 1) {
      toastMessage(
        'Sekcja musi mieć co najmniej jedną pozycję. Aby ją usunąć, użyj kosza sekcji w panelu.',
        'warning',
        4000,
      )
      return
    }
    // Client mirror of the server delete-guard: block a populated row up front so it never
    // optimistically vanishes then reappears. stagesRef is the fresh stage list (dsg column
    // closure is mount-frozen). The server guard stays the authority — see the await below.
    if (isRowPopulated(row, stagesRef.current)) {
      toastMessage('Najpierw wyczyść wartości wpisane w tej pozycji', 'warning', 4000)
      return
    }
    prevById.current.delete(row.id)
    setRows((rs) => applyRemoveItem(rs, row.id))
    const res = await removeItemAction(row.id)
    if (!res.success) {
      // Server rejected (client/server predicate drift) — restore the row and surface the block.
      prevById.current.set(row.id, row)
      setRows((rs) => applyAddItem(rs, row))
      toastMessage(res.error ?? 'Nie udało się usunąć pozycji', 'warning', 4000)
    }
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
      stages,
    })
    prevById.current.set(row.id, row)
    setRows((rs) => applyAddItem(rs, row))
  }

  // --- Stages (etapy) ---

  // A new stage adds a `stage_<id>: 0` key to every current row + snapshot (like patchRows for
  // coeffs), so the column renders 0s (not blanks) and the first progress entry diffs correctly.
  async function handleAddStage() {
    const res = await addStageAction(investmentId)
    if (!res.success) return
    const { id, ordinal } = res.data
    setStages((s) => [...s, { id, ordinal, label: null }])
    patchRows(
      () => true,
      (r) => ({ ...r, [stageKey(id)]: 0 }),
    )
  }

  async function handleRemoveStage(stageId: number) {
    const res = await removeStageAction(stageId)
    if (!res.success) {
      // Server blocks a delete while the stage still holds recorded progress.
      toastMessage(res.error ?? 'Nie udało się usunąć etapu', 'warning', 4000)
      return
    }
    setStages((s) => s.filter((st) => st.id !== stageId))
    const key = stageKey(stageId)
    patchRows(
      () => true,
      (r) => {
        const next = { ...r }
        delete next[key]
        return next
      },
    )
  }

  // Optimistic rename; an empty label reverts to null (the header shows the "Etap N" placeholder).
  // Guard against a no-op write: the header's onBlur fires on every focus-out, so skip when the
  // label is unchanged (the header has no diff of its own, unlike item cells via diffRow).
  function handleRenameStage(stageId: number, label: string) {
    const trimmed = label.trim()
    const next = trimmed === '' ? null : trimmed
    const current = stagesRef.current.find((st) => st.id === stageId)
    if (current && current.label === next) return
    const prevLabel = current?.label ?? null
    setStages((s) => s.map((st) => (st.id === stageId ? { ...st, label: next } : st)))
    // Route through the debounced saver for the same revert-on-error discipline as cell edits.
    // The revert restores the prior label only if nothing newer was typed (label still === next).
    save(
      `stage-label:${stageId}`,
      () => updateStageFieldAction(stageId, next),
      () =>
        setStages((s) =>
          s.map((st) =>
            st.id === stageId && st.label === next ? { ...st, label: prevLabel } : st,
          ),
        ),
    )
  }

  // Bound to the fresh dataset/stages — the summary calls this before its confirm to skip the
  // dialog (and toast) when the section holds recorded work, mirroring the server guard.
  function sectionPopulated(sectionId: number) {
    return isSectionPopulated(rowsRef.current, sectionId, stagesRef.current)
  }

  async function handleRemoveSection(sectionId: number) {
    // Backstop for the summary's pre-check: block a populated section before the optimistic
    // cascade removal (the section delete cascades items + stage_progress server-side).
    if (sectionPopulated(sectionId)) {
      toastMessage('Najpierw wyczyść wartości w pozycjach tej sekcji', 'warning', 4000)
      return
    }
    const removed = rowsRef.current
      .filter((r) => r.sectionId === sectionId)
      .map((r) => prevById.current.get(r.id) ?? r)
    setRows((rs) => rs.filter((r) => r.sectionId !== sectionId))
    for (const [id, r] of prevById.current) {
      if (r.sectionId === sectionId) prevById.current.delete(id)
    }
    const wasActive = activeSectionId === sectionId
    if (wasActive) setActiveSectionId(null)
    const res = await removeSectionAction(sectionId)
    if (!res.success) {
      // Server rejected (predicate drift) — restore the section's rows and surface the block.
      for (const r of removed) prevById.current.set(r.id, r)
      setRows((rs) => [...rs, ...removed])
      if (wasActive) setActiveSectionId(sectionId)
      toastMessage(res.error ?? 'Nie udało się usunąć sekcji', 'warning', 4000)
    }
  }

  function handleRenameSection(sectionId: number, name: string) {
    // The name is denormalized on every row of the section — overwrite them all locally.
    setRows((rs) => rs.map((r) => (r.sectionId === sectionId ? { ...r, sectionName: name } : r)))
    for (const [id, r] of prevById.current) {
      if (r.sectionId === sectionId) prevById.current.set(id, { ...r, sectionName: name })
    }
    void updateSectionFieldAction(sectionId, { name })
  }

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

  // Changing the per-investment VAT rate recomputes every brutto figure. vatRate is denormalized
  // on every row, so patch them all optimistically (router.refresh alone won't reseed `rows` — the
  // useState initializer runs once at mount); then persist + refresh for the panel. `vatRate` is a
  // fraction (0.08), converted from the panel's percent input at the commit site.
  async function handleVatChange(vatRate: number) {
    patchRows(
      () => true,
      (r) => ({ ...r, vatRate }),
    )
    const res = await updateInvestmentVatAction(investmentId, vatRate)
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
      }
      // Stage progress is a distinct save dimension (sparse upsert), keyed per item×stage.
      for (const sc of diff.stageChanges ?? []) {
        const key = stageKey(sc.stageId)
        const prevVal = prev[key]
        save(
          `progress:${row.id}:${sc.stageId}`,
          () => setStageProgressAction(row.id, sc.stageId, sc.qty),
          () => revertOne(row.id, key, prevVal, sc.qty),
        )
      }
      if (diff.itemPatch || diff.stageChanges) changedById.set(row.id, row)
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

  return {
    // grid data + layout
    gridRef,
    gridHeight,
    columns,
    viewRows,
    view,
    sort,
    widthsKey,
    stagesKey,
    guideX,
    // subtotals + section panel
    subtotals,
    totalNet,
    sectionCoeffs,
    // toolbar / panel state
    setView,
    search,
    setSearch,
    activeSectionId,
    setActiveSectionId,
    summaryOpen,
    setSummaryOpen,
    // handlers
    onChange,
    handleAddItem,
    handleAddSection,
    handleAddStage,
    handleRenameSection,
    handleRemoveSection,
    isSectionPopulated: sectionPopulated,
    handleGlobalCoeffChange,
    handleSectionCoeffChange,
    handleVatChange,
  }
}
