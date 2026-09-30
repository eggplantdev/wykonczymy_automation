'use client'

import { Column, keyColumn } from 'react-datasheet-grid'
import { StageHeader } from '@/components/kosztorys/editor/grid/stage-header'
import { STAGE_HEADER_COPY } from '@/components/kosztorys/editor/grid/stage-header-copy'
import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import {
  computedColumn,
  type ComputedColumnStyleT,
} from '@/components/kosztorys/editor/grid/cells/computed-cell'
import { divergenceColumn } from '@/components/kosztorys/editor/grid/cells/divergence-cell'
import {
  subcontractorCoeffColumn,
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
  discountValueColumn,
  discountTypeColumn,
} from '@/components/kosztorys/editor/grid/cells/discount-columns'
import { unitColumn } from '@/components/kosztorys/editor/grid/cells/unit-column'
import { sectionNameColumn } from '@/components/kosztorys/editor/grid/cells/section-name-cell'
import { wrapColumnClass } from '@/lib/kosztorys/row-content-lines'
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
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { formatPercent, formatQty } from '@/lib/kosztorys/format'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  hasStagesOverPlanned,
  isRemainingOverrun,
  measureDiscrepancy,
} from '@/lib/kosztorys/settlement-rows'
import { computedColumnValues } from '@/lib/kosztorys/columns/column-values'
import { memoisedByRow } from '@/lib/kosztorys/columns/memoised-by-row'
import { activeSortPick } from '@/lib/kosztorys/row-view'
import { stagesForView } from '@/lib/kosztorys/settlement-view'
import { stagesMatchingEngaged } from '@/lib/kosztorys/stage-conditions'
import type { KosztorysV2RowT, StageKeyT } from '@/lib/kosztorys/types'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'

// keyColumn wants Column<Row[K]>, but longTextColumn is nullable where the item fields are not, and
// the cell type is invariant, so nothing short of an exact match passes — `any` is the only bridge at
// the library boundary. The cells are null-safe at runtime.
function keyCol(
  key: keyof KosztorysV2RowT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Partial<Column<any>>,
  rest: Partial<Column<KosztorysV2RowT>>,
): Column<KosztorysV2RowT> {
  return { ...(keyColumn(key, column) as Column<KosztorysV2RowT>), ...rest }
}

// An etap with no rozliczenie belongs to neither crew's bill (subcontractor-due.ts), so its
// quantities fall out of both subcontractor sums — a hole only found when the money doesn't add up.
// Only the ilość column: its wartość columns are derived from it and sit beside it, so tinting them
// repeats one warning three times and reads as a figure being wrong, not an etap unassigned.
const PLANE_UNCONFIRMED_CELL = {
  headerClassName: 'bg-destructive/15',
  cellClassName: 'bg-destructive/10 text-destructive',
} as const

// Every data column in sheet order, before any hiding, so the picker can enumerate what EXISTS while
// the grid renders what's visible — no second registry of „which columns are in this view" to drift.
function assembleV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  const { stages, view } = opts
  // Both planes' rates in EVERY view, so the owner compares them without switching tabs. Not a copy:
  // the same factories with the other plane, and the cells read their own `columnData.view`.
  //
  // „Źródło ceny wykonawcy" and „Mnożnik" are the owner's control over a crew's rate, never something
  // the investor may see: both are refused at assembly for the client preview, on top of
  // PREVIEW_VISIBLE_COLUMNS having neither, so a later allowlist edit cannot leak them on its own.
  // The worker surface refuses them for the same reason: a crew seeing its own mnożnik can read the
  // client price straight back off its stawka.
  const withMode = !opts.previewVisible && !opts.workerSurface
  const subcontractorPriceCols: Column<KosztorysV2RowT>[] = TOOL_PLANES.flatMap((plane) => [
    ...(withMode
      ? [
          subcontractorModeColumn(plane, columnTitle(planePriceKey('priceMode', plane), opts)),
          subcontractorCoeffColumn(plane, columnTitle(planePriceKey('priceCoeff', plane), opts)),
        ]
      : []),
    subcontractorPriceColumn(plane, columnTitle(planePriceKey('price', plane), opts)),
  ])
  // All three prices in EVERY view (owner, 2026-09-22): the offer price is what both stawki derive
  // from and what the ceiling guard judges them against, so a crew view owes the owner the
  // denominator beside the verdict.
  //
  // Keeps its bare `price` id: that id is stored in each investment's client-view settings, and
  // renaming it would drop it from the stored hidden set and reveal the price to clients who had
  // hidden it.
  const priceCols: Column<KosztorysV2RowT>[] = [
    // `formatPLN`: „przywrócono 120" would read as a quantity in a grid full of them.
    decimalColumn(
      'price',
      columnTitle('price', opts),
      numericFieldPolicy<'clientPrice', KosztorysV2RowT>('clientPrice', formatPLN),
    ),
    ...subcontractorPriceCols,
  ]
  const identity: Column<KosztorysV2RowT>[] = [
    sectionNameColumn(columnTitle('sectionName', opts), opts.onRenameSection),
    keyCol('description', longTextColumn, {
      id: 'description',
      title: columnTitle('description', opts),
      minWidth: 360,
      grow: 2,
      // Marks the header the row-height measurement reads the width off, and the body cells the
      // clip cue hangs its „…" on.
      headerClassName: wrapColumnClass('description'),
      cellClassName: wrapColumnClass('description'),
    }),
  ]

  // A subcontractor view is one crew's bill, so only that plane's etapy get columns. Nothing becomes
  // uneditable — quantities are typed in the Inwestor view, which shows every etap.
  const viewStages = stagesForView(stages, view)

  // Narrowed HERE and nowhere else, so the three stage axes below cannot drift apart — and
  // deliberately NOT fed to the resolver, whose denominator is Σ etapów of the whole view: hiding
  // columns would otherwise reprice the ones left standing.
  const scaledDownStageIds = opts.scaledDownStageIds ?? new Set<number>()
  const shownStages = stagesMatchingEngaged(viewStages, opts.engagedStageConditionIds ?? [], {
    scaledDownStageIds,
  })

  const valueOf = computedColumnValues({
    stages,
    view,
    executedQtyByItem: opts.workerSurface?.executedQtyByItem,
  })
  const resolvedColumn = (
    id: string,
    style?: ComputedColumnStyleT,
    format?: (value: number | null) => string,
  ) => computedColumn(id, columnTitle(id, opts), valueOf(id), style, format)

  // Przedmiar (sheet N) leads the stage columns so the offered quantity reads before the per-etap
  // execution it is measured against.
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

  // The imported sheet's „Pomiar z natury" against Σ etapów. Owner-only: it is scaffolding for
  // entering old sheets, and a client's document must not carry the company's bookkeeping doubts.
  // Client plane only for a second reason — `measureDiscrepancy` is anchored to the whole offered
  // scope, so on a subcontractor view it would put two different „etapy" numbers side by side.
  //
  // Sits right behind „Opis prac" rather than beside the figure it derives from, and is tied to the
  // diagnostic filter rather than to an imported pomiar: with the filter off it would read „—" down
  // almost every row. The button's count says the rozjazd exists; the column is where you read it.
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

  const stageQtySum: Column<KosztorysV2RowT> = {
    ...resolvedColumn('stageQtySum'),
    minWidth: 110,
  }
  const unit = unitColumn(columnTitle('unit', opts))

  // Rabat is a client concession, never passed to the subcontractor (calc.ts netForQtyForView), so
  // the four discount columns exist in the client view only — elsewhere they would all read zero.
  const discountCols: Column<KosztorysV2RowT>[] =
    view === 'client'
      ? [
          discountValueColumn(columnTitle('discountValue', opts)),
          discountTypeColumn(columnTitle('discountType', opts)),
          resolvedColumn('discountAmount'),
          resolvedColumn('discountAmountGross'),
        ]
      : []

  const pricing: Column<KosztorysV2RowT>[] = [resolvedColumn('priceGross'), ...discountCols]

  const stageCols: Column<KosztorysV2RowT>[] = shownStages.map((st) => {
    // The qty field IS the column id, so the sort wiring is the shape `columnTitle()` builds; the
    // etap menu only hosts it alongside rename/plane/roster.
    const qtyField = stageKey(st.id)
    const header = (
      <StageHeader
        stage={st}
        onRename={opts.onRenameStage}
        onRemove={opts.onRemoveStage}
        onSetPlane={opts.onSetStagePlane}
        workers={opts.workers}
        onSetSplit={opts.onSetStageSplit}
        sort={activeSortPick(opts.sort, qtyField)}
        onSort={opts.onSetSort && ((pick) => opts.onSetSort?.(qtyField, pick))}
        onPersistOrder={opts.onPersistKosztorysOrder}
        executedValue={opts.executedValueByStage?.get(st.id) ?? 0}
        scaledDown={scaledDownStageIds.has(st.id)}
      />
    )
    // Locked until the rozliczenie is picked: qty typed here would be work nobody gets billed for.
    // NOT widened to the worker — a worker-less etap still has a price and still belongs to the
    // executed total, it just isn't attributed to anyone.
    //
    // A COMPUTED cell rather than a `disabled` editable one, because dsg's disabled cell is silent:
    // you type and nothing happens. Same copy as the header badge, hung where the lock is discovered.
    if (st.plane == null) {
      return {
        ...computedColumn(
          qtyField,
          header,
          (r) => r[qtyField] ?? null,
          { tone: 'danger', tip: () => STAGE_HEADER_COPY.planeUnconfirmed },
          // Blank, never „0,00": an etap nobody recorded work in has no quantity, and a zero would
          // read as one that was measured.
          (value) => (value == null ? '' : formatQty(value)),
        ),
        minWidth: 130,
        ...PLANE_UNCONFIRMED_CELL,
      }
    }
    return {
      ...decimalColumn(
        qtyField,
        header,
        numericFieldPolicy<StageKeyT, KosztorysV2RowT>(qtyField, formatQty),
      ),
      minWidth: 130,
    }
  })

  // The sheet's V–AE. Computed at render, never a row field — hence the separate id namespace.
  const stageValueNetCols: Column<KosztorysV2RowT>[] = shownStages.map((st) => {
    const field = stageValueNetKey(st.id)
    return computedColumn(
      field,
      stageValueHeader(st, 'netto', STAGE_VALUE_NET_COLUMN_GROUP, field, opts),
      valueOf(field),
    )
  })

  const stageValueGrossCols: Column<KosztorysV2RowT>[] = shownStages.map((st) => {
    const field = stageValueGrossKey(st.id)
    return computedColumn(
      field,
      stageValueHeader(st, 'brutto', STAGE_VALUE_GROSS_COLUMN_GROUP, field, opts),
      valueOf(field),
    )
  })

  const donePercent: Column<KosztorysV2RowT>[] = [
    resolvedColumn(
      'donePercent',
      {
        // More executed than offered. The >100% says so too, but only the tint says it at a glance
        // across a thousand rows.
        tone: (r) => (hasStagesOverPlanned(r, stages) ? 'danger' : 'muted'),
        emphasize: true,
      },
      formatPercent,
    ),
  ]

  const plannedValue: Column<KosztorysV2RowT>[] = [
    resolvedColumn('plannedNet'),
    resolvedColumn('plannedGross'),
    resolvedColumn('plannedNetForPlane'),
  ]

  const net = resolvedColumn('net', { emphasize: true })
  const gross = resolvedColumn('gross')

  // Komentarz (sheet col T). Sits at the Praca/Postęp seam and carries the left border, so it
  // doubles as the block divider — layer-neutral, hence always visible.
  const komentarz: Column<KosztorysV2RowT>[] = [
    keyCol('note', longTextColumn, {
      id: 'note',
      title: columnTitle('note', opts),
      minWidth: 200,
      grow: 1,
      headerClassName: `border-l border-border ${wrapColumnClass('note')}`,
      cellClassName: `border-l border-border ${wrapColumnClass('note')}`,
    }),
  ]

  // Red on the very rows the footer total leaves out — one predicate, so the two never disagree.
  // Brutto is judged on its netto: same sign, and one tolerance axis instead of two.
  const overrunTone = (netId: string) => {
    const remainingOf = valueOf(netId)
    return (r: KosztorysV2RowT) => (isRemainingOverrun(remainingOf(r) ?? 0) ? 'danger' : 'muted')
  }
  const remainingTone = overrunTone('remaining')
  const remaining: Column<KosztorysV2RowT>[] = [
    resolvedColumn('remaining', { tone: remainingTone }),
    resolvedColumn('remainingGross', { tone: remainingTone }),
  ]
  // Assembled on the worker surface only: anywhere else there is no all-etapy quantity to read, and
  // a figure built from the view's etapy alone would call another crew's work unfinished.
  const remainingForPlane: Column<KosztorysV2RowT>[] = opts.workerSurface
    ? [
        resolvedColumn('remainingForPlane', {
          tone: overrunTone('remainingForPlane'),
        }),
      ]
    : []

  // „Rozjazd" behind the identity block when it exists at all (a work list, not a reading of the
  // sheet), then sheet order proper: N, D–M, O, T at the work/progress seam, then U–AE before AF.
  // The row-actions column rides the same assemble→hide→toggle pipeline as every data column, so the
  // picker can hide it like any other. The investor's and the worker's documents read in their own
  // order instead (`documentOrder`, column-selection.ts).
  const dataColumns = [
    ...identity,
    ...divergence,
    ...przedmiar,
    ...stageCols,
    stageQtySum,
    unit,
    ...priceCols,
    ...pricing,
    ...plannedValue,
    net,
    gross,
    ...komentarz,
    ...stageValueNetCols,
    ...stageValueGrossCols,
    ...donePercent,
    ...remaining,
    ...remainingForPlane,
  ]
  if (opts.readOnly) return dataColumns.map((c) => ({ ...c, disabled: true }))
  return opts.onRemoveItem || opts.onReorderItem
    ? [actionColumn(opts), ...dataColumns]
    : dataColumns
}

// Columns-only assemble — the grid path goes through buildV2Grid. Kept for the column-set unit specs,
// which assert which ids survive a predicate without the picker.
export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  return selectV2Columns(orderAssembled(assembleV2Columns(opts), opts), opts)
}

// One assembly pass: assembleV2Columns is the O(columns·stages) build, so it runs once for both.
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
