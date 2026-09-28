import { MONEY_TOLERANCE, rowPlannedNetForView } from '@/lib/kosztorys/calc'
import { foldUnit } from '@/lib/kosztorys/sheet-import/columns'
import { keyItems } from '@/lib/kosztorys/sheet-import/item-key'
import { QTY_TOLERANCE, rowValueForView } from '@/lib/kosztorys/settlement-rows'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type {
  GlobalDiscountT,
  KosztorysStageT,
  KosztorysTreeT,
  KosztorysV2RowT,
} from '@/lib/kosztorys/types'
import type {
  DiscountChangeT,
  FieldChangeT,
  HistoryDiscountT,
  HistoryVersionT,
  ItemChangeT,
  ItemRefT,
  VersionDiffT,
} from './types'

const moneyChanged = (before: number, after: number) => Math.abs(before - after) >= MONEY_TOLERANCE
const qtyChanged = (before: number, after: number) => Math.abs(before - after) > QTY_TOLERANCE

const itemRef = (row: KosztorysV2RowT): ItemRefT => ({
  id: row.id,
  sectionName: row.sectionName,
  description: row.description,
  unit: row.unit,
  plannedQty: row.plannedQty,
})

// A restore or „wczytaj szablon" mints new ids, so ids alone would read one restore as the whole
// kosztorys removed and added again. Whatever ids leave unmatched on both sides is matched by
// sekcja + opis + j.m. — the j.m. rides keyItems' section slot, so occurrences count per all three.
function matchItems(pastRows: KosztorysV2RowT[], currentRows: KosztorysV2RowT[]) {
  const currentById = new Map(currentRows.map((row) => [row.id, row]))
  const matched = new Map<number, KosztorysV2RowT>()
  for (const row of pastRows) {
    const current = currentById.get(row.id)
    if (current) matched.set(row.id, current)
  }

  const takenCurrentIds = new Set([...matched.values()].map((row) => row.id))
  const keyed = (rows: KosztorysV2RowT[]) =>
    keyItems(rows, (row) => `${row.sectionName}|${foldUnit(row.unit)}`)
  const currentByKey = keyed(currentRows.filter((row) => !takenCurrentIds.has(row.id)))
  for (const [key, row] of keyed(pastRows.filter((row) => !matched.has(row.id)))) {
    const current = currentByKey.get(key)
    if (current) matched.set(row.id, current)
  }
  return matched
}

// By id, then by position for what ids left unmatched — the same restore that remints item ids
// remints the etapy.
function matchStages(past: KosztorysStageT[], current: KosztorysStageT[]) {
  const currentById = new Map(current.map((stage) => [stage.id, stage]))
  const matched = new Map<number, KosztorysStageT>()
  for (const stage of past) {
    const twin = currentById.get(stage.id)
    if (twin) matched.set(stage.id, twin)
  }
  const takenIds = new Set([...matched.values()].map((stage) => stage.id))
  const currentByOrdinal = new Map(
    current.filter((stage) => !takenIds.has(stage.id)).map((stage) => [stage.ordinal, stage]),
  )
  for (const stage of past) {
    if (matched.has(stage.id)) continue
    const twin = currentByOrdinal.get(stage.ordinal)
    if (twin) {
      matched.set(stage.id, twin)
      currentByOrdinal.delete(stage.ordinal)
    }
  }
  return matched
}

const sameDiscount = (a: GlobalDiscountT, b: GlobalDiscountT) =>
  a.type === b.type && (a.type === null || !moneyChanged(a.value, b.value))

function diffDiscount(past: HistoryDiscountT, current: HistoryDiscountT): DiscountChangeT {
  if (!past.known || !current.known) return { state: 'unknown' }
  const before = { type: past.type, value: past.value }
  const after = { type: current.type, value: current.value }
  return sameDiscount(before, after) ? { state: 'same' } : { state: 'changed', before, after }
}

// The history list diffs every entry against the one current tree and against the entry before
// it, so without this each tree is flattened once per pairing — the current one once per entry.
const rowsByTree = new WeakMap<KosztorysTreeT, KosztorysV2RowT[]>()
function rowsOf(tree: KosztorysTreeT): KosztorysV2RowT[] {
  let rows = rowsByTree.get(tree)
  if (!rows) {
    rows = treeToRows(tree)
    rowsByTree.set(tree, rows)
  }
  return rows
}

export function diffVersions(past: HistoryVersionT, current: HistoryVersionT): VersionDiffT {
  const pastRows = rowsOf(past.tree)
  const currentRows = rowsOf(current.tree)
  const pastStages = past.tree.stages
  const currentStages = current.tree.stages

  const matchedItems = matchItems(pastRows, currentRows)
  const matchedStages = matchStages(pastStages, currentStages)
  const matchedCurrentStageIds = new Set([...matchedStages.values()].map((stage) => stage.id))
  const addedStages = currentStages.filter((stage) => !matchedCurrentStageIds.has(stage.id))
  // An etap deleted since reads as its pomiar gone to 0: the work it held is no longer counted.
  const stageColumns = [
    ...pastStages.map((stage) => {
      const twin = matchedStages.get(stage.id)
      return {
        stageId: stage.id,
        label: stageLabel(twin ?? stage),
        pastId: stage.id,
        currentId: twin?.id,
      }
    }),
    ...addedStages.map((stage) => ({
      stageId: stage.id,
      label: stageLabel(stage),
      pastId: undefined,
      currentId: stage.id,
    })),
  ]

  const changed = new Map<number, ItemChangeT>()
  for (const pastRow of pastRows) {
    const currentRow = matchedItems.get(pastRow.id)
    if (!currentRow) continue

    const fields: FieldChangeT[] = []
    if (qtyChanged(pastRow.plannedQty, currentRow.plannedQty)) {
      fields.push({ field: 'plannedQty', before: pastRow.plannedQty, after: currentRow.plannedQty })
    }
    if (moneyChanged(pastRow.clientPrice, currentRow.clientPrice)) {
      fields.push({ field: 'price', before: pastRow.clientPrice, after: currentRow.clientPrice })
    }
    const plannedBefore = rowPlannedNetForView(pastRow, 'client')
    const plannedAfter = rowPlannedNetForView(currentRow, 'client')
    if (moneyChanged(plannedBefore, plannedAfter)) {
      fields.push({ field: 'plannedNet', before: plannedBefore, after: plannedAfter })
    }
    const netBefore = rowValueForView(pastRow, pastStages, 'client')
    const netAfter = rowValueForView(currentRow, currentStages, 'client')
    if (moneyChanged(netBefore, netAfter)) {
      fields.push({ field: 'net', before: netBefore, after: netAfter })
    }

    for (const { stageId, label, pastId, currentId } of stageColumns) {
      const before = pastId === undefined ? 0 : (pastRow[stageKey(pastId)] ?? 0)
      const after = currentId === undefined ? 0 : (currentRow[stageKey(currentId)] ?? 0)
      if (qtyChanged(before, after)) {
        fields.push({ field: 'stageQty', stageId, stageLabel: label, before, after })
      }
    }

    if (fields.length > 0) {
      changed.set(pastRow.id, { item: itemRef(currentRow), fields })
    }
  }

  const matchedCurrentIds = new Set([...matchedItems.values()].map((row) => row.id))
  return {
    added: currentRows.filter((row) => !matchedCurrentIds.has(row.id)).map(itemRef),
    removed: pastRows.filter((row) => !matchedItems.has(row.id)).map(itemRef),
    changed,
    addedStages,
    discount: diffDiscount(past.discount, current.discount),
  }
}

export function hasChanges(diff: VersionDiffT): boolean {
  return (
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.changed.size > 0 ||
    diff.discount.state === 'changed'
  )
}
