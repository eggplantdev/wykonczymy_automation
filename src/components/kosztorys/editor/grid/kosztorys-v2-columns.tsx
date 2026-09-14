'use client'

import { Column, keyColumn } from 'react-datasheet-grid'
import { StageHeader } from '@/components/kosztorys/editor/grid/stage-header'
import { STAGE_HEADER_COPY } from '@/components/kosztorys/editor/grid/stage-header-copy'
import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import { computedColumn } from '@/components/kosztorys/editor/grid/cells/computed-cell'
import { divergenceColumn } from '@/components/kosztorys/editor/grid/cells/divergence-cell'
import {
  subcontractorModeColumn,
  subcontractorPriceColumn,
} from '@/components/kosztorys/editor/grid/cells/subcontractor-columns'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/editor/grid/kosztorys-v2-column-opts'
import { columnTitle, stageValueHeader } from '@/components/kosztorys/editor/grid/column-headers'
import { actionColumn } from '@/components/kosztorys/editor/grid/row-actions-column'
import {
  assembleBaseRanks,
  orderAssembled,
  selectV2Columns,
  selectV2ToggleItems,
} from '@/components/kosztorys/editor/grid/column-selection'
import {
  rowDiscountForView,
  rowDoneFraction,
  rowPlannedNetForView,
  stageValueForView,
  toGross,
  viewPrice,
} from '@/lib/kosztorys/calc'
import {
  discountValueColumn,
  discountTypeColumn,
} from '@/components/kosztorys/editor/grid/cells/discount-columns'
import { unitColumn } from '@/components/kosztorys/editor/grid/cells/unit-column'
import { sectionNameColumn } from '@/components/kosztorys/editor/grid/cells/section-name-cell'
import { wrapColumnHeaderClass } from '@/lib/kosztorys/row-content-lines'
import { longTextColumn } from '@/components/ui/datasheet-grid/long-text-cell'
import { type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import {
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  stageKey,
  stageValueGrossKey,
  stageValueNetKey,
} from '@/lib/kosztorys/stage-keys'
import { type ColumnRanksT } from '@/lib/table/column-order'
import { headerTipFor } from '@/lib/kosztorys/header-tips'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { formatPercent, formatQty } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  hasStagesOverPlanned,
  measureDiscrepancy,
  rowRemainingForView,
  rowTotalQtyDone,
  rowValueForView,
} from '@/lib/kosztorys/settlement-rows'
import { activeSortPick } from '@/lib/kosztorys/row-view'
import { stagesForView } from '@/lib/kosztorys/settlement-view'
import { stagesMatchingEngaged } from '@/lib/kosztorys/stage-conditions'
import type { KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'

// keyColumn requires column: Column<Row[K]>. longTextColumn is nullable (Column<string|null>)
// whereas the item fields are non-null. The cell type is invariant (rowData covariant + setRowData
// contravariant), so no concrete type other than an exact match will pass — the only safe bridge is
// `any` at the library boundary. The cells are null-safe at runtime; we return a ready
// Column<KosztorysV2RowT>.
function keyCol(
  key: keyof KosztorysV2RowT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Partial<Column<any>>,
  rest: Partial<Column<KosztorysV2RowT>>,
): Column<KosztorysV2RowT> {
  return { ...(keyColumn(key, column) as Column<KosztorysV2RowT>), ...rest }
}

// An etap with no rozliczenie belongs to neither crew’s bill (subcontractor-due.ts), so its quantities fall
// out of both subcontractor sums — the kind of hole that is only found when the money doesn't add up.
// So the ilość column screams, header and every cell. Reachable in the client view only, which is the
// one that shows every etap.
//
// Only the ilość column: its wartość columns are derived from it and sit right beside it, so tinting
// them repeats one etap's warning three times — and their red totals row reads as a figure being
// wrong rather than an etap being unassigned.
const PLANE_UNCONFIRMED_CELL = {
  headerClassName: 'bg-destructive/15',
  cellClassName: 'bg-destructive/10 text-destructive',
} as const

// Every data column in sheet order, before any hiding. Split out from buildV2Columns so the picker
// can enumerate what EXISTS while the grid renders what's visible — one list, no second registry of
// "which columns are there in this view" to drift.
function assembleV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  const { stages, view } = opts
  // Both planes' subcontractor rates in EVERY view, so the owner compares them without switching
  // tabs. Not a copy of the columns: the same factories called with the other plane, which is why the
  // two can't drift — the cells read their own `columnData.view`, never the active view.
  //
  // „Źródło ceny wykonawcy" is the exception: it is an EDIT control, not a figure to compare, and the
  // client view is where the offer is read, so it assembles only on the subcontractor planes. The
  // rate itself stays editable in EVERY view — typing a number IS „kwota stała", and Delete is the
  // way back to „auto", so the column needs no source picker beside it to be fully operable. The
  // rates are hidden by default (DEFAULT_HIDDEN_COLUMNS) and barred from the client preview by the
  // allowlist.
  const withMode = view !== 'client'
  const subcontractorPriceCols: Column<KosztorysV2RowT>[] = TOOL_PLANES.flatMap((plane) => [
    ...(withMode
      ? [subcontractorModeColumn(plane, columnTitle(planePriceKey('priceMode', plane), opts))]
      : []),
    subcontractorPriceColumn(plane, columnTitle(planePriceKey('price', plane), opts)),
  ])
  // The client's own „Cena j.m. netto" is a different figure — the offer price, editable only where
  // the offer is read — so it stays on the client view and keeps its bare `price` id (that id is
  // allowlisted and stored in each investment's client-view settings; renaming it would DROP it from the
  // stored hidden set and reveal the price to clients who had hidden it).
  const priceCols: Column<KosztorysV2RowT>[] =
    view === 'client'
      ? [
          // `formatPLN`: „przywrócono 120" would read as a quantity in a grid full of them.
          decimalColumn(
            'price',
            columnTitle('price', opts),
            numericFieldPolicy<'clientPrice', KosztorysV2RowT>('clientPrice', formatPLN),
          ),
          ...subcontractorPriceCols,
        ]
      : subcontractorPriceCols
  const identity: Column<KosztorysV2RowT>[] = [
    sectionNameColumn(columnTitle('sectionName', opts), opts.onRenameSection),
    keyCol('description', longTextColumn, {
      id: 'description',
      title: columnTitle('description', opts),
      minWidth: 360,
      grow: 2,
      // Marks the header cell the row-height measurement reads this column's width off.
      headerClassName: wrapColumnHeaderClass('description'),
    }),
  ]

  // A subcontractor view is one crew's bill: only that plane's etapy get columns at all. Nothing
  // becomes uneditable — quantities are typed in the Inwestor view, which shows every etap.
  const viewStages = stagesForView(stages, view)

  // Which of those actually get columns, once the „Problemy" filters have their say. Narrowed HERE and
  // nowhere else, so the three stage axes below cannot drift apart — and deliberately NOT fed to
  // `totalQtyDone`: the share each etap's wartość is computed against is Σ etapów of the whole view, so
  // hiding columns would otherwise silently reprice the ones left standing.
  const shownStages = stagesMatchingEngaged(viewStages, opts.engagedStageConditionIds ?? [])

  // Rows are replaced immutably on every edit, so row identity is a self-invalidating cache key — a
  // stale value can't outlive the row it was computed from.
  const memoisedByRow = <T,>(compute: (row: KosztorysV2RowT) => T) => {
    const cache = new WeakMap<KosztorysV2RowT, { value: T }>()
    return (row: KosztorysV2RowT) => {
      const hit = cache.get(row)
      if (hit) return hit.value
      const value = compute(row)
      cache.set(row, { value })
      return value
    }
  }

  // Σ etapów for the row — the denominator every stage-value cell divides by. There are 2×|etapy| of
  // those cells per row (netto + brutto) and each would otherwise re-run the O(|etapy|) reduce to
  // arrive at the SAME number, making a row O(|etapy|²).
  const totalQtyDone = memoisedByRow((row: KosztorysV2RowT) =>
    rowTotalQtyDone(row, viewStages, view),
  )

  // Przedmiar (sheet N, the offered scope) leads the stage columns rather than following them, so the
  // offered quantity reads before the per-etap execution it is measured against.
  const przedmiar: Column<KosztorysV2RowT>[] = [
    {
      ...decimalColumn(
        'plannedQty',
        columnTitle('plannedQty', opts),
        numericFieldPolicy<'plannedQty', KosztorysV2RowT>('plannedQty', formatQty),
      ),
      minWidth: 150,
    },
  ]

  // The imported sheet's „Pomiar z natury" against Σ etapów.
  //
  // Owner-only: the reference figure is scaffolding for entering old sheets into the app, and a
  // client's document must not carry the company's own bookkeeping doubts. Client plane only for a
  // second reason: `measureDiscrepancy` is hard-anchored to the whole offered scope, so hanging it
  // on a subcontractor view's cell would put two different „etapy" numbers side by side.
  //
  // Right behind „Opis prac" rather than beside „Pomiar", the figure it is derived from — it is the
  // answer to „ile jeszcze zostało", which nobody should have to scroll 8 columns to read.
  // Tied to the diagnostic filter, not to the presence of an imported pomiar: while the filter is off
  // the grid holds every pozycja and this column would be „—" down almost all of it. The button's own
  // count is what says the rozjazd exists; the column is where you read it.
  const divergence: Column<KosztorysV2RowT>[] =
    !opts.previewVisible && view === 'client' && opts.divergenceFilterEngaged
      ? [
          {
            ...divergenceColumn(
              columnTitle('divergence', opts),
              memoisedByRow((row: KosztorysV2RowT) => measureDiscrepancy(row, stages)),
            ),
            cellClassName: 'border-border border-r',
          },
        ]
      : []

  const measure: Column<KosztorysV2RowT>[] = [
    {
      ...computedColumn('stageQtySum', columnTitle('stageQtySum', opts), (r) => totalQtyDone(r)),
      minWidth: 80,
    },
    unitColumn(columnTitle('unit', opts)),
  ]

  // Rabat is a client concession, never passed to the subcontractor (calc.ts netForQtyForView), so
  // the four discount columns exist in the client view only — the subcontractor views never assemble
  // them, and their discount figures would be zero anyway.
  const discountCols: Column<KosztorysV2RowT>[] =
    view === 'client'
      ? [
          discountValueColumn(columnTitle('discountValue', opts)),
          discountTypeColumn(columnTitle('discountType', opts)),
          computedColumn('discountAmount', columnTitle('discountAmount', opts), (r) =>
            rowDiscountForView(r, totalQtyDone(r), view),
          ),
          computedColumn('discountAmountGross', columnTitle('discountAmountGross', opts), (r) =>
            toGross(rowDiscountForView(r, totalQtyDone(r), view), r.vatRate),
          ),
        ]
      : []

  const pricing: Column<KosztorysV2RowT>[] = [
    ...priceCols,
    computedColumn('priceGross', columnTitle('priceGross', opts), (r) =>
      toGross(viewPrice(r, view), r.vatRate),
    ),
    ...discountCols,
  ]

  const stageCols: Column<KosztorysV2RowT>[] = shownStages.map((st) => {
    // The qty field IS the column id, so the sort wiring is the same shape `columnTitle()` builds — the
    // etap menu just hosts it alongside rename/plane/roster instead of owning the whole menu.
    const qtyField = stageKey(st.id)
    const header = (
      <StageHeader
        stage={st}
        onRename={opts.onRenameStage}
        onRemove={opts.onRemoveStage}
        onSetPlane={opts.onSetStagePlane}
        workers={opts.workers}
        onSetWorker={opts.onSetStageWorker}
        sort={activeSortPick(opts.sort, qtyField)}
        onSort={opts.onSetSort && ((pick) => opts.onSetSort?.(qtyField, pick))}
        onPersistOrder={opts.onPersistKosztorysOrder}
        executedValue={opts.executedValueByStage?.get(st.id) ?? 0}
      />
    )
    // Locked until the rozliczenie is picked: qty typed here would be work nobody gets billed for,
    // and picking one costs a click. Deliberately NOT widened to the worker — a worker-less etap
    // still has a price and still belongs to the executed total; it just isn't attributed to anyone.
    //
    // The lock renders as a COMPUTED cell, not as a `disabled` editable one: dsg's disabled cell is
    // silent — you type, nothing happens, and the red tint is the only hint that this was deliberate.
    // The reason already existed as copy (STAGE_HEADER_COPY.planeUnconfirmed) but only on a badge in
    // the header, which is not where anyone looks after a keystroke goes nowhere. Same string, hung
    // where the lock is discovered.
    if (st.plane == null) {
      return {
        ...computedColumn(
          qtyField,
          header,
          (r) => r[qtyField] ?? null,
          { tone: 'danger', tip: () => STAGE_HEADER_COPY.planeUnconfirmed },
          // Blank, never „0,00": an etap nobody has recorded work in has no quantity, and a zero
          // would read as one that was measured.
          (value) => (value == null ? '' : formatQty(value)),
        ),
        minWidth: 110,
        ...PLANE_UNCONFIRMED_CELL,
      }
    }
    return {
      ...decimalColumn(
        qtyField,
        header,
        numericFieldPolicy<StageKeyT, KosztorysV2RowT>(qtyField, formatQty),
      ),
      minWidth: 110,
    }
  })

  // The sheet's V–AE: the value of each stage's recorded qty at the view's price, post-discount.
  // Computed at render, never a row field — hence the separate id namespace (constants.ts).
  const stageValueNetCols: Column<KosztorysV2RowT>[] = shownStages.map((st) => {
    const qtyKey = stageKey(st.id)
    const field = stageValueNetKey(st.id)
    const header = stageValueHeader(
      st,
      'netto',
      headerTipFor(STAGE_VALUE_NET_COLUMN_GROUP),
      field,
      opts,
    )
    return computedColumn(field, header, (r) =>
      stageValueForView(r, r[qtyKey] ?? 0, totalQtyDone(r), view),
    )
  })

  const stageValueGrossCols: Column<KosztorysV2RowT>[] = shownStages.map((st) => {
    const qtyKey = stageKey(st.id)
    const field = stageValueGrossKey(st.id)
    const header = stageValueHeader(
      st,
      'brutto',
      headerTipFor(STAGE_VALUE_GROSS_COLUMN_GROUP),
      field,
      opts,
    )
    return computedColumn(field, header, (r) =>
      toGross(stageValueForView(r, r[qtyKey] ?? 0, totalQtyDone(r), view), r.vatRate),
    )
  })

  // The przedmiar-anchored columns here and below compute at `'client'` outright, not at `view`:
  // PRZEDMIAR_ANCHORED_COLUMNS drops them outside the client view, so a `view`-reactive formula would
  // be false generality — it reads as if a subcontractor reading existed, and there isn't one.
  const donePercent: Column<KosztorysV2RowT>[] = [
    computedColumn(
      'donePercent',
      columnTitle('donePercent', opts),
      (r) => rowDoneFraction(r, rowTotalQtyDone(r, stages, 'client')),
      {
        // Red = more was executed than was offered. The percentage says so too (>100%), but only
        // this cell says it at a glance across a thousand rows.
        tone: (r) => (hasStagesOverPlanned(r, stages) ? 'danger' : 'muted'),
        emphasize: true,
      },
      formatPercent,
    ),
  ]

  const plannedValue: Column<KosztorysV2RowT>[] = [
    computedColumn('plannedNet', columnTitle('plannedNet', opts), (r) =>
      rowPlannedNetForView(r, 'client'),
    ),
    computedColumn('plannedGross', columnTitle('plannedGross', opts), (r) =>
      toGross(rowPlannedNetForView(r, 'client'), r.vatRate),
    ),
  ]

  const computed: Column<KosztorysV2RowT>[] = [
    ...plannedValue,
    computedColumn('net', columnTitle('net', opts), (r) => rowValueForView(r, stages, view), {
      emphasize: true,
    }),
    computedColumn('gross', columnTitle('gross', opts), (r) =>
      toGross(rowValueForView(r, stages, view), r.vatRate),
    ),
  ]

  // Komentarz (sheet col T): the row's free-text note. Plain text column — the `note` field is
  // already diffed/persisted; this only surfaces it in the grid. Sits at the Praca/Postęp seam and
  // carries the left border, so it doubles as the block divider (layer-neutral → always visible).
  const komentarz: Column<KosztorysV2RowT>[] = [
    keyCol('note', longTextColumn, {
      id: 'note',
      title: columnTitle('note', opts),
      minWidth: 200,
      grow: 1,
      headerClassName: `border-l border-border ${wrapColumnHeaderClass('note')}`,
      cellClassName: 'border-l border-border',
    }),
  ]

  const remaining: Column<KosztorysV2RowT>[] = [
    computedColumn('remaining', columnTitle('remaining', opts), (r) =>
      rowRemainingForView(r, stages, 'client'),
    ),
    computedColumn('remainingGross', columnTitle('remainingGross', opts), (r) =>
      toGross(rowRemainingForView(r, stages, 'client'), r.vatRate),
    ),
  ]

  // „Rozjazd" right behind the identity block when it exists at all (see above — it is a work list,
  // not a reading of the sheet),
  // then sheet order proper: Przedmiar (N) leads the stage qty columns (the sheet's D–M), then Pomiar z natury (O), then
  // Komentarz (T) at the work/progress seam, then the value block (U–AE right before AF "pozostało").
  // The row-actions column leads the whole grid when editing is enabled — it rides the same
  // assemble→hide→toggle pipeline as every data column (no special-casing), so the picker can hide it
  // like any other.
  const dataColumns = [
    ...identity,
    ...divergence,
    ...przedmiar,
    ...stageCols,
    ...measure,
    ...pricing,
    ...computed,
    ...komentarz,
    ...stageValueNetCols,
    ...stageValueGrossCols,
    ...donePercent,
    ...remaining,
  ]
  if (opts.readOnly) return dataColumns.map((c) => ({ ...c, disabled: true }))
  return opts.onRemoveItem || opts.onReorderItem
    ? [actionColumn(opts), ...dataColumns]
    : dataColumns
}

// Columns-only assemble — the grid path goes through buildV2Grid; kept for the column-set unit specs
// (money-axis / layer), which assert which ids survive a predicate without the picker.
export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  return selectV2Columns(orderAssembled(assembleV2Columns(opts), opts), opts)
}

// The grid + its picker in one assembly pass — assembleV2Columns is the O(columns·stages) build, so
// it runs once and returns both instead of once per export.
export function buildV2Grid(opts: BuildV2ColumnsOptsT): {
  columns: Column<KosztorysV2RowT>[]
  columnToggleItems: ColumnToggleItemT[]
  columnBaseRanks: ColumnRanksT
} {
  const assembled = assembleV2Columns(opts)
  const ordered = orderAssembled(assembled, opts)
  return {
    columns: selectV2Columns(ordered, opts),
    columnToggleItems: selectV2ToggleItems(ordered, opts),
    columnBaseRanks: assembleBaseRanks(assembled),
  }
}
