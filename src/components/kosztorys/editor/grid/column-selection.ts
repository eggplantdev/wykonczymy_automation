import { Column } from 'react-datasheet-grid'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { appendTrailingGap, withResize } from '@/components/kosztorys/editor/grid/column-sizing'
import { withColumnColor } from '@/components/kosztorys/editor/grid/column-color'
import { type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import { stageGroupOfKey, stageIdOfKey } from '@/lib/kosztorys/stage-keys'
import {
  baseRanksFromKeys,
  groupColumns,
  orderColumns,
  type ColumnRanksT,
} from '@/lib/table/column-order'
import { clientDocumentColumns } from '@/lib/kosztorys/client-view/settings'
import {
  CREW_PLANE_ONLY_COLUMNS,
  PRZEDMIAR_ANCHORED_COLUMNS,
  UNPICKABLE_COLUMNS,
  bypassedByGlobalDiscount,
  columnLabelForView,
} from '@/lib/kosztorys/columns/column-config'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/client-view/columns'
import {
  WORKSHOP_UNPICKABLE_COLUMNS,
  WORKSHOP_VISIBLE_COLUMNS,
} from '@/lib/kosztorys/workshop-columns'
import { AI_REVIEW_COLUMN_IDS } from '@/lib/kosztorys/ai-review-columns'
import { OFFER_VISIBLE_COLUMNS } from '@/lib/kosztorys/offer-columns'
import { CREW_AXIS_DEFAULT, crewAxisAllows } from '@/lib/kosztorys/crew-axis'
import { LAYER_DEFAULT, layerAllows } from '@/lib/kosztorys/layer'
import { MONEY_AXIS_DEFAULT, axisAllows } from '@/lib/kosztorys/money-axis'
import { workerDocumentColumns, workerVisibleColumns } from '@/lib/kosztorys/worker-view/settings'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

function toggleKey(columnId: string): string {
  return stageGroupOfKey(columnId) ?? columnId
}

// Split them and PREVIEW_VISIBLE_COLUMNS keeps letting `price`/`net` through while they compute a
// subcontractor's cost basis — client-named columns holding contractor numbers, a leak with no
// foreign column to notice.
function assertDisclosurePair(opts: BuildV2ColumnsOptsT): void {
  if (opts.previewVisible && opts.view !== 'client') {
    throw new Error(
      `previewVisible requires view='client' (got '${opts.view}') — the column allowlist does not pin the price plane.`,
    )
  }
  const worker = opts.workerSurface
  if (!worker) return
  if (opts.previewVisible) {
    throw new Error('workerSurface and previewVisible are two audiences — pass one.')
  }
  if (opts.view !== worker.plane) {
    throw new Error(
      `workerSurface requires view='${worker.plane}' (got '${opts.view}') — the worker list does not pin the price plane.`,
    )
  }
}

function closedColumnList(opts: BuildV2ColumnsOptsT): ReadonlySet<string> | null {
  if (opts.previewVisible) return PREVIEW_VISIBLE_COLUMNS
  if (opts.workerSurface) {
    return workerVisibleColumns(opts.workerSurface.plane, opts.workerSurface.hiddenColumns)
  }
  if (opts.offerVisible) {
    return opts.aiColumnsShown
      ? new Set([...OFFER_VISIBLE_COLUMNS, ...AI_REVIEW_COLUMN_IDS])
      : OFFER_VISIBLE_COLUMNS
  }
  return null
}

function documentOrder(opts: BuildV2ColumnsOptsT): readonly string[] | null {
  if (opts.previewVisible) return clientDocumentColumns(opts.previewColumnRanks ?? {})
  if (opts.workerSurface) {
    return workerDocumentColumns(opts.workerSurface.plane, opts.workerSurface.columnRanks)
  }
  return null
}

export function selectV2Columns(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT>[] {
  assertDisclosurePair(opts)
  const axis = opts.moneyAxis ?? MONEY_AXIS_DEFAULT
  const layer = opts.layer ?? LAYER_DEFAULT
  const crew = opts.crewAxis ?? CREW_AXIS_DEFAULT
  // while it is on, the per-item rabat fields are bypassed rather than cleared (calc.ts
  // `applyDiscount`) — so showing those columns would print „Rabat 10 %" beside „Kwota rabatu 0,00"
  // on the offer itself.
  const closed = closedColumnList(opts)
  const documentHidden =
    opts.previewVisible || opts.workerSurface ? opts.documentHiddenColumns : undefined
  const stageProblemEngaged = [...(opts.engagedStageConditionIds ?? [])].length > 0
  const keep = (id: string): boolean => {
    const key = toggleKey(id)
    if (bypassedByGlobalDiscount(key, opts.globalDiscountActive)) return false
    // A closed list is a ceiling AND a floor: the preference gates below persist per BROWSER and no
    // control on a closed surface edits them.
    if (closed) return closed.has(key) && !documentHidden?.has(key) && !documentHidden?.has(id)
    if (opts.workshopVisible) {
      return (
        WORKSHOP_VISIBLE_COLUMNS.has(key) &&
        (WORKSHOP_UNPICKABLE_COLUMNS.has(key) ||
          (opts.revealedColumnIds?.has(key) ?? false) ||
          !opts.isHidden?.(key))
      )
    }
    if (opts.view !== 'client' && PRZEDMIAR_ANCHORED_COLUMNS.has(key)) return false
    if (opts.view === 'client' && CREW_PLANE_ONLY_COLUMNS.has(key)) return false
    const stageId = stageIdOfKey(id)
    if (stageId !== null && !stageProblemEngaged && opts.isStageHidden?.(stageId)) return false
    // six diagnostics are plane-bound („Stawka ujemna — z narzędziami" and its five siblings), so
    // with that crew's columns put away the filter hides pozycje and never shows the stawka that
    // explains why
    const revealed = opts.revealedColumnIds?.has(key) ?? false
    return (
      (UNPICKABLE_COLUMNS.has(key) || revealed || !opts.isHidden?.(key)) &&
      axisAllows(key, axis) &&
      layerAllows(key, layer) &&
      (revealed || crewAxisAllows(key, crew))
    )
  }
  const base = assembled
    .filter((c) => keep(c.id ?? ''))
    .map((c) => withColumnColor(withResize(c, opts), opts))
  return appendTrailingGap(base, opts)
}

export function selectV2ToggleItems(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): ColumnToggleItemT[] {
  if (closedColumnList(opts)) return []
  const items: ColumnToggleItemT[] = []
  for (const col of assembled) {
    const id = toggleKey(col.id ?? '')
    if (items.some((i) => i.id === id)) continue
    if (bypassedByGlobalDiscount(id, opts.globalDiscountActive)) continue
    if (UNPICKABLE_COLUMNS.has(id)) continue
    if (opts.workshopVisible) {
      if (WORKSHOP_VISIBLE_COLUMNS.has(id) && !WORKSHOP_UNPICKABLE_COLUMNS.has(id)) {
        items.push({ id, label: columnLabelForView(id, opts.view), visible: !opts.isHidden?.(id) })
      }
      continue
    }
    if (opts.view !== 'client' && PRZEDMIAR_ANCHORED_COLUMNS.has(id)) continue
    if (opts.view === 'client' && CREW_PLANE_ONLY_COLUMNS.has(id)) continue
    if (!crewAxisAllows(id, opts.crewAxis ?? CREW_AXIS_DEFAULT)) continue
    items.push({ id, label: columnLabelForView(id, opts.view), visible: !opts.isHidden?.(id) })
  }
  return items
}

export function orderAssembled(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT>[] {
  const order = documentOrder(opts)
  if (order) return orderColumns(assembled, baseRanksFromKeys(order), toggleKey)
  if (closedColumnList(opts) || !opts.columnRanks || Object.keys(opts.columnRanks).length === 0) {
    return assembled
  }
  return orderColumns(assembled, opts.columnRanks, toggleKey)
}

export function assembleBaseRanks(assembled: Column<KosztorysV2RowT>[]): ColumnRanksT {
  return baseRanksFromKeys([...groupColumns(assembled, toggleKey).keys()])
}
