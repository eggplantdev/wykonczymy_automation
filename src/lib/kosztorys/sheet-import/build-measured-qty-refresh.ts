import type { SheetMeasuredQtyRowT } from '@/lib/db/kosztorys-sheet-measured-qty'
import { QTY_TOLERANCE } from '@/lib/kosztorys/settlement-rows'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import type { SheetColumnMappingT } from './sheet-column-mapping'
import { keyItems } from './item-key'
import { parseLaborTab } from './parse-labor-tab'
import type { ImportGridsT } from './read-sheet'
import { resolveLaborColumns } from './resolve-columns'

export type MeasuredQtyRefreshT = {
  rows: SheetMeasuredQtyRowT[]
  unmatched: number
}

export type MeasuredQtyRefreshResultT =
  | { ok: true; refresh: MeasuredQtyRefreshT }
  | { ok: false; problems: string[] }

// The stored figure round-trips through `numeric`, so an equality test has to allow the same slack
// the rozjazd itself calls „no difference" — otherwise a re-read would rewrite rows nothing changed.
const sameQty = (stored: number | null, fromSheet: number | null): boolean =>
  stored === null || fromSheet === null
    ? stored === fromSheet
    : Math.abs(stored - fromSheet) < QTY_TOLERANCE

/**
 * A matched pozycja whose sheet Pomiar is a formula or an empty cell yields `null`, not a skip: the
 * sheet stopped claiming a hand-typed measurement, and a stale reference figure surviving that would
 * make „Rozjazd" answer with a number nobody stands behind any more.
 */
export function buildMeasuredQtyRefresh(
  grids: ImportGridsT,
  currentTree: SnapshotPayloadT,
  mapping?: SheetColumnMappingT,
): MeasuredQtyRefreshResultT {
  const resolved = resolveLaborColumns(grids.laborGrid, mapping)
  if (!resolved.ok) return { ok: false, problems: resolved.problems }

  // Without this guard those nulls flow into the diff below as a difference against every stored
  // figure and the write clears the lot — silently, since the dialog reports the unresolved column
  // but not the wipe.
  if (resolved.columns.measuredQty === undefined)
    return { ok: true, refresh: { rows: [], unmatched: 0 } }

  const parsed = parseLaborTab(grids.laborGrid, resolved, grids.laborGridFormulas)

  const sheetSectionName = new Map(parsed.sections.map((section) => [section.id, section.name]))
  const appSectionName = new Map(currentTree.sections.map((section) => [section.id, section.name]))

  const sheetByKey = keyItems(
    parsed.items as unknown as KosztorysItemT[],
    (item) => sheetSectionName.get(item.sectionId) ?? '',
  )
  const appByKey = keyItems(currentTree.items, (item) => appSectionName.get(item.sectionId) ?? '')

  const rows: SheetMeasuredQtyRowT[] = []
  let unmatched = 0
  for (const [key, item] of appByKey) {
    const fromSheet = sheetByKey.get(key)
    if (!fromSheet) {
      unmatched++
      continue
    }
    const qty = fromSheet.sheetMeasuredQty
    if (!sameQty(item.sheetMeasuredQty, qty)) rows.push({ id: item.id, qty })
  }
  return { ok: true, refresh: { rows, unmatched } }
}
