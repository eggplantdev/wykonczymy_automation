'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDebouncedSave } from '@/components/kosztorys/use-debounced-save'
import {
  coalesceFieldChanges,
  coalesceStageChanges,
  type FieldChangeT,
  type StageChangeT,
} from '@/lib/kosztorys/undo-coalesce'
import { useUndoRedoContext } from '@/components/kosztorys/use-undo-redo'
import { useColumnWidths } from '@/components/kosztorys/use-column-widths'
import { useHiddenColumns } from '@/components/kosztorys/use-hidden-columns'
import { useLayer } from '@/components/kosztorys/use-layer'
import { useMoneyAxis } from '@/components/kosztorys/use-money-axis'
import { usePriceView } from '@/components/kosztorys/use-price-view'
import { useProgressDisplay } from '@/components/kosztorys/use-progress-display'
import { useElementHeight } from '@/hooks/use-element-height'
import { toastMessage } from '@/lib/utils/toast'
import { buildV2Grid } from '@/components/kosztorys/kosztorys-v2-columns'
import { type V2SortStateT } from '@/components/kosztorys/kosztorys-v2-column-opts'
import {
  diffRow,
  inverseGlobalCoeffPatch,
  inverseSectionCoeffPatch,
  treeToRows,
} from '@/lib/kosztorys/v2-rows'
import {
  applyAddItem,
  applyInsertItem,
  applyRemoveItem,
  applyRestoreItem,
  buildBlankRow,
  insertDisplayOrder,
  revertField,
  sectionNeighbor,
  swapItemInSection,
} from '@/lib/kosztorys/row-ops'
import {
  planItemRemoval,
  planItemRemovalFromCounts,
  sectionItemCounts,
  type ItemRemovalPlanT,
} from '@/lib/kosztorys/delete-policy'
import { sectionSubtotalsForView } from '@/lib/kosztorys/settlement'
import { filterRows, sortRows, type SortDirT } from '@/lib/kosztorys/row-view'
import { columnSortValue, reconcileSort } from '@/lib/kosztorys/sort-value'
import { NEW_SECTION_DEFAULTS } from '@/lib/kosztorys/constants'
import {
  stageKey,
  stageValueGrossKey,
  stageValueNetKey,
  stageValuePercentKey,
} from '@/lib/kosztorys/stage-keys'
import { globalDiscountAmount, isGlobalDiscountActive } from '@/lib/kosztorys/calc'
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
  updateInvestmentGlobalDiscountAction,
  updateInvestmentVatAction,
  updateItemFieldAction,
  updateSectionFieldAction,
  updateStageFieldAction,
} from '@/lib/actions/kosztorys'
import type {
  GlobalDiscountT,
  ItemPatchT,
  KosztorysStageT,
  KosztorysTreeT,
  KosztorysV2RowT,
} from '@/lib/kosztorys/types'

type ArgsT = { investmentId: number; tree: KosztorysTreeT }

// A reorder command records the two rows' ids and pre-swap orders. FieldChangeT/StageChangeT (the
// per-field / per-stage before+after a grid batch records) live with the burst-coalescing reducer.
type OrderRefT = { id: number; order: number }

// Grace period after the last keystroke before a grid edit burst becomes one undo entry. Longer
// than the debounced save (500ms) so a command is captured only once the writes for the burst have
// been scheduled — never mid-typing.
const UNDO_COALESCE_MS = 700

// All editor state, derived data, and handlers for the in-app kosztorys grid. Kept out of the
// component so the component is only composition + markup. Handlers never fire an action from
// inside a setRows updater — that would move the Router during render.
export function useKosztorysEditor({ investmentId, tree }: ArgsT) {
  const router = useRouter()
  const { save, cancel } = useDebouncedSave(500)
  // Per-mount undo/redo stack, provided by the shell (KosztorysEditorV2). Capture pushes here;
  // the toolbar + keyboard call undo/redo (re-exported below).
  const { push, undo, redo, canUndo, canRedo } = useUndoRedoContext()
  const [gridRef, gridHeight] = useElementHeight()
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() => treeToRows(tree))
  // Stages live in local state (like `rows`): add/remove optimistically add/drop a column.
  const [stages, setStages] = useState<KosztorysStageT[]>(tree.stages)
  // Global discount in local state (like `rows`/`stages`): the toggle patches it optimistically so
  // the derived total, column visibility, and per-item suppression all move in one render. Reading
  // `tree.globalDiscount` instead would leave the total + columns lagging the row flag until
  // router.refresh() lands — the transient the "never disagree" invariant below forbids.
  const [globalDiscount, setGlobalDiscount] = useState<GlobalDiscountT>(tree.globalDiscount)
  const globalDiscountActive = isGlobalDiscountActive(globalDiscount)
  const [view, setView] = usePriceView(investmentId)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<V2SortStateT>(null)
  // Section filter, three states: null = no filter (all sections), a Set = show exactly those, an
  // empty Set = show none. The „show none" state is why this can't be a plain Set with empty=all —
  // the FilterMultiSelect toggle-all needs a distinct „Odznacz wszystkie" target.
  const [shownSectionIds, setShownSectionIds] = useState<Set<number> | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(true)
  // Column widths: persisted in localStorage, committed on handle release (not per pointermove —
  // that would be a write per pixel). During the drag we only show a vertical guide
  // (guideX = cursor X), without touching the grid.
  const { widths, setWidth, dropWidth } = useColumnWidths()
  const { isHidden, toggleColumn, showAllColumns } = useHiddenColumns()
  const [moneyAxis, setMoneyAxis] = useMoneyAxis()
  const [progressDisplay, setProgressDisplay] = useProgressDisplay()
  const [layer, setLayer] = useLayer()
  const [guideX, setGuideX] = useState<number | null>(null)
  // Snapshot of the previous rows for diffing (keyed by item id) — the full dataset, not the view.
  // It also serves as the "fresh dataset" read by structural event handlers (section count):
  // kept in sync on every add/remove/edit, so no separate ref for rows is needed.
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))
  // "Latest value" ref: the fresh `rows` (display order) read during an event-time reorder, since
  // firing an action inside the setRows updater would update the Router during render (a React
  // error). Writing a ref during render is the well-known, safe "latest value" pattern.
  // NOTE (EX-422): these two refs were introduced to dodge a mount-frozen column closure, which no
  // longer exists — the grid is on the reactive `DynamicDataSheetGrid` export as of `ee497cb`, so
  // its closures are rebuilt each render. Kept deliberately as the rollback path; whether they are
  // still load-bearing is EX-422's own follow-up, not a freebie to delete alongside it.
  const rowsRef = useRef(rows)
  // eslint-disable-next-line react-hooks/refs
  rowsRef.current = rows
  // Same, for the stage-rename handler's no-op guard (compares against the fresh label).
  const stagesRef = useRef(stages)
  // eslint-disable-next-line react-hooks/refs
  stagesRef.current = stages

  // Grid edit burst awaiting a coalesced undo entry (see UNDO_COALESCE_MS). onChange appends each
  // keystroke's changes here; the flush timer collapses them into a single command once typing stops.
  const pendingFields = useRef<FieldChangeT[]>([])
  const pendingStages = useRef<StageChangeT[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Collapse the buffered burst into one undo command (before=first seen, after=last), dropping a
  // net-zero burst (type-then-revert) entirely so it never lands a dead entry on the stack.
  function flushUndoBuffer() {
    if (flushTimer.current) {
      clearTimeout(flushTimer.current)
      flushTimer.current = null
    }
    const fields = coalesceFieldChanges(pendingFields.current)
    const stages = coalesceStageChanges(pendingStages.current)
    pendingFields.current = []
    pendingStages.current = []
    if (fields.length === 0 && stages.length === 0) return
    push({
      label: 'Edycja',
      undo: () => runGridReversal(fields, stages, 'undo'),
      redo: () => runGridReversal(fields, stages, 'redo'),
    })
  }

  // A restore remounts the body; drop any dangling burst timer so a pending flush can't push a
  // command closing over the outgoing mount's setRows/prevById.
  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current)
    }
  }, [])

  // Push a structural command (reorder / rename / coeff / VAT) — flushing any still-buffering grid
  // edit first, so a burst typed just before the structural action keeps its correct chronological
  // (LIFO) place on the stack instead of being pushed after it.
  function pushCommand(cmd: Parameters<typeof push>[0]) {
    flushUndoBuffer()
    push(cmd)
  }

  // A structural command whose reversal is just re-running one `apply` with the before/after state —
  // direction is expressed by which argument is replayed, so undo and redo share the same function.
  function pushReversible<T>(label: string, apply: (state: T) => void, before: T, after: T) {
    pushCommand({ label, undo: () => apply(before), redo: () => apply(after) })
  }

  function setSortField(field: string, dir: SortDirT | null) {
    setSort(dir ? { field, dir } : null)
  }

  // One O(n) pass feeding the render-hot getRemovePlan (see below) an O(1) per-row lookup.
  const removalCounts = sectionItemCounts(rows)

  // onRemoveItem/onReorderItem read prevById.current / rowsRef.current — stable refs —
  // only from a cell's onClick, never during render, so passing them here is safe.
  const columnOpts = {
    view,
    stages,
    onRemoveStage: handleRemoveStage,
    onRenameStage: handleRenameStage,
    sort,
    onSetSort: setSortField,
    isHidden,
    moneyAxis,
    progressDisplay,
    layer,
    widths,
    onGuide: setGuideX,
    onCommitColumn: setWidth,
    onRemoveItem: handleRemoveItem,
    onReorderItem: handleReorderItem,
    onInsertItem: handleInsertItem,
    onRenameSection: handleRenameSection,
    getRemovePlan,
    globalDiscountActive,
  }
  const { columns, columnToggleItems } = buildV2Grid(columnOpts)
  // A column sort must not outlive its column. A money-axis or view toggle can drop the sorted
  // column, taking its SortHeader — the only control that clears the sort — with it, while the sort
  // state lingers: the rows freeze in an unexplained order and the row actions stay disabled with no
  // way to re-enable them (EX-486). Forget the sort when its field stops rendering. Cleared as real
  // state, not derived, so it does not resurrect if the column later returns (owner, 2026-07-17).
  // setState during render is React's sanctioned "adjust state on an input change" path: the
  // condition bails the loop, and this render (its columns built with the stale sort) is discarded
  // before commit — the column set is sort-independent, so the retry rebuilds the same columns.
  const renderedFieldIds = new Set(
    columns.map((c) => c.id).filter((id): id is string => id != null),
  )
  if (reconcileSort(sort, renderedFieldIds) !== sort) setSort(null)

  // View = filter + sort. Edits are mapped back into the full dataset by id.
  const viewRows = useMemo(() => {
    const scoped =
      shownSectionIds === null ? rows : rows.filter((r) => shownSectionIds.has(r.sectionId))
    const filtered = filterRows(scoped, search)
    if (!sort) return filtered
    return sortRows(filtered, (r) => columnSortValue(r, sort.field, view, stages), sort.dir)
  }, [rows, shownSectionIds, search, sort, view, stages])

  // Per-section subtotals: the FULL dataset (not viewRows) — a stable breakdown independent of
  // the filter/sort.
  const subtotals = useMemo(() => sectionSubtotalsForView(rows, stages, view), [rows, stages, view])
  // Executed total at the active view — the money the totals bar shows and the base the global
  // discount comes off. Full-dataset (like the subtotals): a search or section filter must not move it.
  const totalNet = useMemo(() => subtotals.reduce((s, x) => s + x.net, 0), [subtotals])
  // The progress counter is a PROGRESS figure, not money — it must read the same in every price view,
  // so its executed/offered are weighted at the client price (a separate client-priced pass), never
  // the active `view`. Same client basis as each section's completionRatio.
  const progressSubtotals = useMemo(
    () => sectionSubtotalsForView(rows, stages, 'client'),
    [rows, stages],
  )
  const doneNet = useMemo(
    () => progressSubtotals.reduce((s, x) => s + x.net, 0),
    [progressSubtotals],
  )
  const plannedNet = useMemo(
    () => progressSubtotals.reduce((s, x) => s + x.plannedNet, 0),
    [progressSubtotals],
  )

  // Global discount amount + "do zapłaty", computed ONCE here off the executed total. Both total
  // surfaces (the Sekcje Suma block and the totals bar) read these props — neither recomputes, so
  // they can never disagree.
  const discountAmount = useMemo(
    () => globalDiscountAmount(totalNet, globalDiscount),
    [totalNet, globalDiscount],
  )
  const doZaplatyNet = totalNet - discountAmount

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

  // Apply one direction of a captured grid-edit batch (undo → `before`, redo → `after`). Unlike an
  // autosave, an undo is a deliberate user action: it pre-empts any pending debounced save for the
  // key (so a stale forward write can't race the inverse), writes the target value immediately, and
  // updates `rows` + `prevById` in lockstep so the next onChange diff doesn't re-fire the write.
  async function runGridReversal(
    fields: FieldChangeT[],
    stages: StageChangeT[],
    dir: 'undo' | 'redo',
  ) {
    // Merge every change of one row into a single patch so multi-field/-stage rows apply at once.
    const patchById = new Map<number, Record<string, unknown>>()
    for (const c of fields) {
      cancel(`item:${c.id}:${String(c.field)}`)
      const patch = patchById.get(c.id) ?? {}
      patch[c.field as string] = dir === 'undo' ? c.before : c.after
      patchById.set(c.id, patch)
    }
    for (const c of stages) {
      cancel(`progress:${c.id}:${c.stageId}`)
      const patch = patchById.get(c.id) ?? {}
      patch[stageKey(c.stageId)] = dir === 'undo' ? c.before : c.after
      patchById.set(c.id, patch)
    }
    setRows((rs) =>
      rs.map((r) =>
        patchById.has(r.id) ? ({ ...r, ...patchById.get(r.id) } as KosztorysV2RowT) : r,
      ),
    )
    for (const [id, patch] of patchById) {
      const snap = prevById.current.get(id)
      if (snap) prevById.current.set(id, { ...snap, ...patch } as KosztorysV2RowT)
    }
    const writes: Promise<unknown>[] = []
    for (const c of fields) {
      const value = dir === 'undo' ? c.before : c.after
      writes.push(updateItemFieldAction(c.id, { [c.field]: value } as ItemPatchT))
    }
    for (const c of stages) {
      const value = dir === 'undo' ? c.before : c.after
      writes.push(setStageProgressAction(c.id, c.stageId, value))
    }
    await Promise.all(writes)
    // Pull recomputed section/stage totals once the inverse writes have committed.
    router.refresh()
  }

  // Reverse (or replay) a ▲▼ swap: exchange the two rows' array positions and re-issue the
  // display_order swap. Self-inverse — undo restores each row's pre-swap order, redo re-applies the
  // original. Matches handleReorderItem: no prevById touch (display_order isn't a diffed field) and
  // no totals refresh (a reorder doesn't change any figure).
  function runReorderReversal(a: OrderRefT, b: OrderRefT, dir: 'undo' | 'redo') {
    setRows((rs) => {
      const ia = rs.findIndex((r) => r.id === a.id)
      const ib = rs.findIndex((r) => r.id === b.id)
      if (ia < 0 || ib < 0) return rs
      const next = [...rs]
      ;[next[ia], next[ib]] = [next[ib], next[ia]]
      return next
    })
    void swapItemOrderAction(
      { id: a.id, displayOrder: dir === 'undo' ? a.order : b.order },
      { id: b.id, displayOrder: dir === 'undo' ? b.order : a.order },
    )
  }

  async function handleAddItem(sectionId: number) {
    const res = await addItemAction(sectionId)
    if (!res.success) return
    // Take the denormalized section fields from any existing row of that section.
    const sample = [...prevById.current.values()].find((r) => r.sectionId === sectionId)
    const row = buildBlankRow({
      id: res.data.id,
      displayOrder: res.data.displayOrder,
      sectionId,
      sectionName: sample?.sectionName ?? NEW_SECTION_DEFAULTS.name,
      vatRate: tree.vatRate,
      globalDiscountActive,
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
    // With a section filter active, a row added to a hidden section would be invisible — pull its
    // section into the filter so the add is visible.
    setShownSectionIds((prev) =>
      prev === null || prev.has(sectionId) ? prev : new Set(prev).add(sectionId),
    )
  }

  // ⋯ menu → Wstaw pozycję powyżej/poniżej. Inserts a blank row at the anchor's display slot
  // (±1) within the anchor's section. "Above/below" has no meaning against a price-sorted view, so
  // it's a no-op while a column sort is active (the menu also disables it). Denormalized section
  // fields come from any existing row of that section (as in handleAddItem).
  async function handleInsertItem(anchorRow: KosztorysV2RowT, dir: 'above' | 'below') {
    if (sort) return
    const at = insertDisplayOrder(anchorRow, dir)
    const res = await insertItemAction(anchorRow.sectionId, at)
    if (!res.success) return
    const sample =
      [...prevById.current.values()].find((r) => r.sectionId === anchorRow.sectionId) ?? anchorRow
    const row = buildBlankRow({
      id: res.data.id,
      displayOrder: res.data.displayOrder,
      sectionId: anchorRow.sectionId,
      sectionName: sample.sectionName,
      vatRate: tree.vatRate,
      globalDiscountActive,
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

  // What deleting a row does — read at event time from the full dataset (prevById), not the view,
  // so the handler decides on accurate counts. The render-hot per-cell path uses getRemovePlan.
  function removalPlan(row: KosztorysV2RowT) {
    return planItemRemoval([...prevById.current.values()], row, stagesRef.current)
  }

  // Render-hot: called per cell. Counts are precomputed once per render (removalCounts below), so this
  // is O(1) per row — going through removalPlan (which spreads prevById and rescans per row) here would
  // make the whole grid's per-row delete plan O(n²).
  function getRemovePlan(row: KosztorysV2RowT): ItemRemovalPlanT {
    return planItemRemovalFromCounts(
      rows.length,
      removalCounts.get(row.sectionId) ?? 0,
      row,
      stagesRef.current,
    )
  }

  async function handleRemoveItem(row: KosztorysV2RowT) {
    const plan = removalPlan(row)
    // Backstop: the trash button is disabled when a reason exists, so this is normally unreachable.
    if (plan.kind === 'blocked') {
      toastMessage(plan.reason, 'warning', 4000)
      return
    }
    // Last item in its section → cascade-delete the section so no orphaned 0-row section is left.
    if (plan.kind === 'cascade-section') {
      await handleRemoveSection(row.sectionId)
      return
    }
    const rowsAtRemoval = rowsRef.current
    const removedAt = rowsAtRemoval.findIndex((r) => r.id === row.id)
    const afterId = removedAt > 0 ? rowsAtRemoval[removedAt - 1].id : null
    prevById.current.delete(row.id)
    setRows((rs) => applyRemoveItem(rs, row.id))
    const res = await removeItemAction(row.id)
    if (!res.success) {
      // Server rejected (client/server predicate drift) — restore the row after the neighbor it
      // followed, resolved against the current rows so a concurrent edit during the await can't
      // misplace it (applyAddItem would re-append it at the grid's end).
      prevById.current.set(row.id, row)
      setRows((rs) => applyRestoreItem(rs, row, afterId))
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
    const a: OrderRefT = { id: row.id, order: row.displayOrder }
    const b: OrderRefT = { id: neighbor.id, order: neighbor.displayOrder }
    pushCommand({
      label: 'Zmiana kolejności',
      undo: () => runReorderReversal(a, b, 'undo'),
      redo: () => runReorderReversal(a, b, 'redo'),
    })
  }

  async function handleAddSection() {
    const sec = await addSectionAction(investmentId)
    if (!sec.success) return
    // A new section immediately gets a blank item (an empty section = 0 rows = invisible).
    const item = await addItemAction(sec.data.id)
    if (!item.success) return
    const row = buildBlankRow({
      id: item.data.id,
      displayOrder: item.data.displayOrder,
      sectionId: sec.data.id,
      sectionName: NEW_SECTION_DEFAULTS.name,
      vatRate: tree.vatRate,
      globalDiscountActive,
      sectionDefaultCostVariant: NEW_SECTION_DEFAULTS.defaultCostVariant,
      sectionWToolsCoeff: null,
      sectionOwnToolsCoeff: null,
      globalWToolsCoeff: tree.globalCoeffs.wTools,
      globalOwnToolsCoeff: tree.globalCoeffs.ownTools,
      stages,
    })
    prevById.current.set(row.id, row)
    setRows((rs) => applyAddItem(rs, row))
    // Drop a section filter: the new section's row lives outside it, so keeping the filter would
    // make the add look like a no-op (nothing visibly happens).
    setShownSectionIds(null)
  }

  // Append the sections returned by appendPresetSectionsAction to the grid without a reload. The rows
  // are built through treeToRows (the same denormalization as the initial load), using the CURRENT
  // stages + global discount so the appended rows carry today's stage columns and rabat flag — the
  // action already committed with real ids, so no temp-id reconciliation. router.refresh() alone
  // can't add them (mount-frozen `rows`, EX-441); it still runs for the prop-reading surfaces.
  function handleAppendedSections(slice: KosztorysTreeT['sections']) {
    const appended = treeToRows({
      sections: slice,
      stages,
      progress: [],
      globalCoeffs: tree.globalCoeffs,
      vatRate: tree.vatRate,
      globalDiscount,
      revision: tree.revision,
    })
    for (const row of appended) prevById.current.set(row.id, row)
    setRows((rs) => [...rs, ...appended])
    // The appended sections live outside any active filter — clear it so they're visible.
    setShownSectionIds(null)
    router.refresh()
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
      toastMessage(res.error ?? 'Nie udało się usunąć etapu', 'warning', 4000)
      return
    }
    setStages((s) => s.filter((st) => st.id !== stageId))
    const key = stageKey(stageId)
    dropWidth(
      key,
      stageValueNetKey(stageId),
      stageValueGrossKey(stageId),
      stageValuePercentKey(stageId),
    )
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

  async function handleRemoveSection(sectionId: number) {
    // The summary confirms before calling here (EX-477); a populated section cascade-deletes its
    // items + stage_progress server-side, guarded only by the confirm dialog, not a block.
    const removed = rowsRef.current
      .filter((r) => r.sectionId === sectionId)
      .map((r) => prevById.current.get(r.id) ?? r)
    setRows((rs) => rs.filter((r) => r.sectionId !== sectionId))
    for (const [id, r] of prevById.current) {
      if (r.sectionId === sectionId) prevById.current.delete(id)
    }
    const wasShown = shownSectionIds?.has(sectionId) ?? false
    if (wasShown) {
      setShownSectionIds((prev) => {
        if (prev === null) return prev
        const next = new Set(prev)
        next.delete(sectionId)
        return next
      })
    }
    const res = await removeSectionAction(sectionId)
    if (!res.success) {
      // Server rejected (predicate drift) — restore the section's rows and surface the block.
      for (const r of removed) prevById.current.set(r.id, r)
      setRows((rs) => [...rs, ...removed])
      if (wasShown)
        setShownSectionIds((prev) => (prev === null ? prev : new Set(prev).add(sectionId)))
      toastMessage(res.error ?? 'Nie udało się usunąć sekcji', 'warning', 4000)
    }
  }

  // The name is denormalized on every row of the section — patch them all (rows + prevById) and
  // persist. Extracted so an undo/redo can re-run it with the before/after name (unlike a grid cell,
  // the rename fires the action directly, not via the debounced saver — nothing to cancel on undo).
  function applySectionRename(sectionId: number, name: string) {
    patchRows(
      (r) => r.sectionId === sectionId,
      (r) => ({ ...r, sectionName: name }),
    )
    void updateSectionFieldAction(sectionId, { name })
  }

  function handleRenameSection(sectionId: number, name: string) {
    // Skip a no-op write: the cell's onBlur fires on every focus-out, so bail when the name is
    // unchanged (the Sekcja cell has no diff of its own, like handleRenameStage for etap labels).
    const before = rowsRef.current.find((r) => r.sectionId === sectionId)?.sectionName
    if (before === undefined || before === name) return
    applySectionRename(sectionId, name)
    pushReversible(
      'Zmiana nazwy sekcji',
      (n: string) => applySectionRename(sectionId, n),
      before,
      name,
    )
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

  // Shared tail of every optimistic settings write (global coeff / VAT / discount / section coeff).
  // The caller has already applied its optimistic patch and captured whatever `revert` needs; this
  // persists, then on success refreshes so the panel re-reads `tree`, or on failure runs `revert` and
  // surfaces the error. Tail-only on purpose: the optimistic apply and the pre-patch capture differ
  // per setting and stay at the call site — only this success-or-rollback tail was identical.
  async function optimisticSettingSave(
    persist: () => Promise<{ success: boolean; error?: string }>,
    revert: () => void,
    errorMessage: string,
  ) {
    const res = await persist()
    if (res.success) {
      router.refresh()
      return
    }
    revert()
    toastMessage(res.error ?? errorMessage, 'warning', 4000)
  }

  // Changing the global coefficient recomputes the derived prices of all non-overridden items.
  // Optimistic patch on the rows + a refresh for the panel (which reads from `tree`). Extracted so
  // undo/redo can re-run it with a before/after patch of the same keys.
  async function applyGlobalCoeff(patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) {
    // patchRows builds fresh row objects, so `sample` still holds the pre-patch coefficients for the
    // revert. Only the coefficients present in `patch` map to their denormalized row fields.
    const sample = rowsRef.current[0]
    const applied: { globalWToolsCoeff?: number; globalOwnToolsCoeff?: number } = {}
    if (patch.wToolsCoeff != null) applied.globalWToolsCoeff = patch.wToolsCoeff
    if (patch.ownToolsCoeff != null) applied.globalOwnToolsCoeff = patch.ownToolsCoeff
    patchRows(
      () => true,
      (r) => ({ ...r, ...applied }),
    )
    await optimisticSettingSave(
      () => updateInvestmentCoeffsAction(investmentId, patch),
      () => {
        // Roll the optimistic coefficients back so the grid doesn't show an unsaved price (the
        // once-only useState seed means a plain refresh can't reseed it). No-op on an empty kosztorys.
        if (!sample) return
        const restored: { globalWToolsCoeff?: number; globalOwnToolsCoeff?: number } = {}
        if (patch.wToolsCoeff != null) restored.globalWToolsCoeff = sample.globalWToolsCoeff
        if (patch.ownToolsCoeff != null) restored.globalOwnToolsCoeff = sample.globalOwnToolsCoeff
        patchRows(
          () => true,
          (r) => ({ ...r, ...restored }),
        )
      },
      'Nie udało się zapisać współczynnika',
    )
  }

  async function handleGlobalCoeffChange(patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) {
    const before = inverseGlobalCoeffPatch(patch, rowsRef.current[0])
    await applyGlobalCoeff(patch)
    pushReversible('Zmiana współczynnika', applyGlobalCoeff, before, patch)
  }

  // Changing the per-investment VAT rate recomputes every brutto figure. vatRate is denormalized
  // on every row, so patch them all optimistically (router.refresh alone won't reseed `rows` — the
  // useState initializer runs once at mount); then persist + refresh for the panel. `vatRate` is a
  // fraction (0.08), converted from the panel's percent input at the commit site.
  async function applyVat(vatRate: number) {
    const prevVatRate = rowsRef.current[0]?.vatRate
    patchRows(
      () => true,
      (r) => ({ ...r, vatRate }),
    )
    await optimisticSettingSave(
      () => updateInvestmentVatAction(investmentId, vatRate),
      () => {
        // Roll the optimistic VAT back (no-op when there were no rows to patch). The toast still fires
        // regardless — it lives in optimisticSettingSave, so an empty kosztorys can't swallow the failure.
        if (prevVatRate === undefined) return
        patchRows(
          () => true,
          (r) => ({ ...r, vatRate: prevVatRate }),
        )
      },
      'Nie udało się zapisać stawki VAT',
    )
  }

  async function handleVatChange(vatRate: number) {
    const before = rowsRef.current[0]?.vatRate ?? tree.vatRate
    await applyVat(vatRate)
    if (before !== vatRate) pushReversible('Zmiana stawki VAT', applyVat, before, vatRate)
  }

  // Setting/clearing the global discount flips per-item rabat on or off for every row. Update the
  // local discount (drives the derived totals + column visibility) and patch the denormalized active
  // flag on every row in the same render, so all three surfaces move together; then persist + refresh.
  async function handleGlobalDiscountChange(next: GlobalDiscountT) {
    const prevDiscount = globalDiscount
    const active = isGlobalDiscountActive(next)
    setGlobalDiscount(next)
    patchRows(
      () => true,
      (r) => ({ ...r, globalDiscountActive: active }),
    )
    await optimisticSettingSave(
      () =>
        updateInvestmentGlobalDiscountAction(investmentId, {
          globalDiscountType: next.type,
          globalDiscountValue: next.value,
        }),
      () => {
        // Roll all three surfaces back so they don't disagree on an unsaved discount.
        setGlobalDiscount(prevDiscount)
        patchRows(
          () => true,
          (r) => ({ ...r, globalDiscountActive: isGlobalDiscountActive(prevDiscount) }),
        )
      },
      'Nie udało się zapisać rabatu',
    )
  }

  // Section coefficient (null = inherits the global) — patch only the rows of that section.
  async function applySectionCoeff(
    sectionId: number,
    patch: { wToolsCoeff?: number | null; ownToolsCoeff?: number | null },
  ) {
    // `in` (not `!= null`): a null coefficient means "inherit the global" — a valid value to write,
    // distinct from "this field wasn't touched". Mirrors handleGlobalCoeffChange.
    const sample = rowsRef.current.find((r) => r.sectionId === sectionId)
    const inSection = (r: KosztorysV2RowT) => r.sectionId === sectionId
    const applied: { sectionWToolsCoeff?: number | null; sectionOwnToolsCoeff?: number | null } = {}
    if ('wToolsCoeff' in patch) applied.sectionWToolsCoeff = patch.wToolsCoeff ?? null
    if ('ownToolsCoeff' in patch) applied.sectionOwnToolsCoeff = patch.ownToolsCoeff ?? null
    patchRows(inSection, (r) => ({ ...r, ...applied }))
    await optimisticSettingSave(
      () => updateSectionFieldAction(sectionId, patch),
      () => {
        // Restore the section's prior coefficients so the grid doesn't show an unsaved price.
        if (!sample) return
        const restored: {
          sectionWToolsCoeff?: number | null
          sectionOwnToolsCoeff?: number | null
        } = {}
        if ('wToolsCoeff' in patch) restored.sectionWToolsCoeff = sample.sectionWToolsCoeff
        if ('ownToolsCoeff' in patch) restored.sectionOwnToolsCoeff = sample.sectionOwnToolsCoeff
        patchRows(inSection, (r) => ({ ...r, ...restored }))
      },
      'Nie udało się zapisać współczynnika sekcji',
    )
  }

  async function handleSectionCoeffChange(
    sectionId: number,
    patch: { wToolsCoeff?: number | null; ownToolsCoeff?: number | null },
  ) {
    const sample = rowsRef.current.find((r) => r.sectionId === sectionId)
    const before = inverseSectionCoeffPatch(patch, sample)
    await applySectionCoeff(sectionId, patch)
    pushReversible(
      'Zmiana współczynnika sekcji',
      (p: typeof patch) => applySectionCoeff(sectionId, p),
      before,
      patch,
    )
  }

  function onChange(next: KosztorysV2RowT[]) {
    const changedById = new Map<number, KosztorysV2RowT>()
    // One onChange batch (incl. a multi-cell paste) = one composite undo entry; accumulate every
    // field/stage change here and buffer a single coalesced command after the loop.
    const fieldChanges: FieldChangeT[] = []
    const stageChanges: StageChangeT[] = []
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
          fieldChanges.push({
            id: row.id,
            field: field as keyof ItemPatchT,
            before: prevVal,
            after: attempted,
          })
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
        stageChanges.push({
          id: row.id,
          stageId: sc.stageId,
          before: Number(prevVal) || 0,
          after: sc.qty,
        })
      }
      if (diff.itemPatch || diff.stageChanges) changedById.set(row.id, row)
      prevById.current.set(row.id, row)
    }
    if (fieldChanges.length > 0 || stageChanges.length > 0) {
      pendingFields.current.push(...fieldChanges)
      pendingStages.current.push(...stageChanges)
      if (flushTimer.current) clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(flushUndoBuffer, UNDO_COALESCE_MS)
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
    columnToggleItems,
    toggleColumn,
    showAllColumns,
    moneyAxis,
    setMoneyAxis,
    progressDisplay,
    setProgressDisplay,
    layer,
    setLayer,
    viewRows,
    view,
    sort,
    guideX,
    // subtotals + section panel
    subtotals,
    totalNet,
    doneNet,
    plannedNet,
    sectionCoeffs,
    globalDiscount,
    discountAmount,
    doZaplatyNet,
    // toolbar / panel state
    setView,
    search,
    setSearch,
    shownSectionIds,
    setShownSectionIds,
    summaryOpen,
    setSummaryOpen,
    // handlers
    onChange,
    handleAddItem,
    handleAddSection,
    handleAppendedSections,
    handleAddStage,
    handleRenameSection,
    handleRemoveSection,
    handleGlobalCoeffChange,
    handleSectionCoeffChange,
    handleVatChange,
    handleGlobalDiscountChange,
    // undo/redo (stack lives in the shell; consumed by the toolbar + keyboard). Both flush a
    // still-buffering edit burst first, so an undo pops the just-typed edit (correct LIFO) rather
    // than an older command that the un-pushed burst is sitting in front of.
    undo: () => {
      flushUndoBuffer()
      undo()
    },
    redo: () => {
      flushUndoBuffer()
      redo()
    },
    canUndo,
    canRedo,
  }
}
