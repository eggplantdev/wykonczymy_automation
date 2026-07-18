'use client'

import { type ReactNode } from 'react'
import { Column, type CellProps, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'
import { SortHeader } from '@/components/kosztorys/sort-header'
import { StageHeader } from '@/components/kosztorys/stage-header'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysRowActionsMenu } from '@/components/kosztorys/kosztorys-row-actions-menu'
import { ResizableHeader } from '@/components/kosztorys/column-resize-handle'
import { computedColumn } from '@/components/kosztorys/cells/computed-cell'
import {
  subcontractorCoeffColumn,
  subcontractorModeColumn,
  subcontractorPriceColumn,
} from '@/components/kosztorys/cells/subcontractor-columns'
import { type BuildV2ColumnsOptsT } from '@/components/kosztorys/kosztorys-v2-column-opts'
import {
  rowDiscountForView,
  rowDoneFraction,
  rowPlannedNetForView,
  stageDoneFraction,
  stageValueForView,
  toGross,
  viewPrice,
} from '@/lib/kosztorys/calc'
import {
  discountValueColumn,
  discountTypeColumn,
} from '@/components/kosztorys/cells/discount-columns'
import { unitColumn } from '@/components/kosztorys/cells/unit-column'
import { SectionNameCell } from '@/components/kosztorys/cells/section-name-cell'
import { type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import {
  STAGE_QTY_PREFIX,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_PERCENT_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
  stageKey,
  stageValueGrossKey,
  stageValueNetKey,
  stageValuePercentKey,
} from '@/lib/kosztorys/stage-keys'
import { COLUMN_LABELS, COLUMN_LAYER } from '@/lib/kosztorys/column-config'
import { HEADER_TIPS } from '@/lib/kosztorys/header-tips'
import { LAYER_DEFAULT, layerAllows } from '@/lib/kosztorys/layer'
import { MONEY_AXIS_DEFAULT, axisAllows } from '@/lib/kosztorys/money-axis'
import { PROGRESS_DISPLAY_DEFAULT, progressDisplayAllows } from '@/lib/kosztorys/progress-display'
import { formatPercent } from '@/lib/kosztorys/format'
import {
  hasStagesOverPlanned,
  rowRemainingForView,
  rowTotalQtyDone,
  rowValueForView,
} from '@/lib/kosztorys/settlement'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// floatColumn right-aligns by default; the grid reads cleaner with every cell left-aligned under
// its (left-aligned) header, so numbers don't float at the far edge of wide columns.
const floatColumnLeft = {
  ...floatColumn,
  columnData: { ...floatColumn.columnData, alignRight: false },
}

// The four per-item rabat columns hidden while the global discount overrides them.
const DISCOUNT_COLUMN_IDS = new Set([
  'discountValue',
  'discountType',
  'discountAmount',
  'discountAmountGross',
])

// keyColumn requires column: Column<Row[K]>. floatColumn/textColumn are nullable
// (Column<number|null> / <string|null>), whereas the item fields are non-null. The cell type is
// invariant (rowData covariant + setRowData contravariant), so no concrete type other than an
// exact match will pass — the only safe bridge is `any` at the library boundary. The cells are
// null-safe at runtime; we return a ready Column<KosztorysV2RowT>.
function keyCol(
  key: keyof KosztorysV2RowT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Partial<Column<any>>,
  rest: Partial<Column<KosztorysV2RowT>>,
): Column<KosztorysV2RowT> {
  return { ...(keyColumn(key, column) as Column<KosztorysV2RowT>), ...rest }
}

function withTip(node: ReactNode, tip: string): ReactNode {
  return (
    <SimpleTooltip content={tip}>
      <span className="flex size-full items-center">{node}</span>
    </SimpleTooltip>
  )
}

// Column title as a sort-menu header (when onSetSort is provided), wrapped in an explanatory
// tooltip when the field has one in HEADER_TIPS.
// `sortable: false` for columns whose value is categorical or dash-laden (the subcontractor
// „źródło ceny" pair) — a sort trigger there would render a caret over a sort nothing can resolve.
function title(
  field: string,
  label: string,
  opts: Pick<BuildV2ColumnsOptsT, 'sort' | 'onSetSort'>,
  sortable = true,
): ReactNode {
  const active = opts.sort?.field === field ? opts.sort.dir : null
  const tip = HEADER_TIPS[field]
  // The tip goes ONTO the sort trigger (same element), not around it — a second wrapping trigger
  // would fight the dropdown for the click. Plain-label columns have no trigger, so wrap directly.
  if (opts.onSetSort && sortable) {
    return (
      <SortHeader
        label={label}
        active={active}
        tip={tip}
        onSort={(dir) => opts.onSetSort?.(field, dir)}
      />
    )
  }
  const node = <span>{label}</span>
  return tip ? withTip(node, tip) : node
}

// Header of a per-stage value column: a read-only mirror of the stage's name. One source for the
// name, so a rename moves all three of the stage's headers and a delete takes all three columns.
// Deliberately not `title(...)` — these columns carry per-stage dynamic ids that columnSortValue
// (lib/kosztorys/sort-value) has no case for, so a sort trigger here would render an arrow that does
// nothing. Deliberately not `StageHeader` — a mirror carries no rename/delete affordance of its own.
function stageValueHeader(stage: KosztorysStageT, suffix: string, tip: string): ReactNode {
  // truncate, not wrap: the label is the user's free text and the suffix trails it, so an
  // unbounded header would push the row's height around as stages get renamed.
  return withTip(
    <span className="truncate text-sm">{`${stage.label || `Etap ${stage.ordinal}`} — ${suffix}`}</span>,
    tip,
  )
}

function withResize(
  col: Column<KosztorysV2RowT>,
  opts: Pick<BuildV2ColumnsOptsT, 'onGuide' | 'onCommitColumn' | 'widths'>,
): Column<KosztorysV2RowT> {
  if (!opts.onGuide || !opts.onCommitColumn || !col.id) return col
  // A fixed-width column (min === max, e.g. the row-actions column) has nothing to drag — skip the
  // resizable header rather than hang a dead handle on it.
  if (col.minWidth != null && col.minWidth === col.maxWidth) return col
  const min = col.minWidth ?? 100
  const pinned = opts.widths?.[col.id]
  // Pinning = a rigid width independent of dsg's flex algorithm: min=max=basis=W,
  // grow/shrink 0. (dsg ignored `basis` alone on overflow — it fell back to minWidth.)
  const sized: Column<KosztorysV2RowT> =
    pinned != null
      ? { ...col, basis: pinned, grow: 0, shrink: 0, minWidth: pinned, maxWidth: pinned }
      : col
  return {
    ...sized,
    title: (
      <ResizableHeader
        colId={col.id}
        minWidth={min}
        onGuide={opts.onGuide}
        onCommit={opts.onCommitColumn}
      >
        {col.title}
      </ResizableHeader>
    ),
  }
}

// Insert/move disabled under an active sort (no display_order mapping); delete disabled with a
// reason (last item in a section, or a populated row) surfaced via tooltip.
function RowActionsCell({
  rowData,
  opts,
}: {
  rowData: KosztorysV2RowT
  opts: BuildV2ColumnsOptsT
}) {
  const sortActive = opts.sort != null
  const plan = opts.getRemovePlan?.(rowData)
  const removeBlockReason = plan?.kind === 'blocked' ? plan.reason : undefined
  const removeNeedsConfirm = plan != null && plan.kind !== 'blocked' && plan.requiresConfirm

  return (
    <KosztorysRowActionsMenu
      sortActive={sortActive}
      removeBlockReason={removeBlockReason}
      removeNeedsConfirm={removeNeedsConfirm}
      onInsertAbove={() => opts.onInsertItem?.(rowData, 'above')}
      onInsertBelow={() => opts.onInsertItem?.(rowData, 'below')}
      onMoveUp={() => opts.onReorderItem?.(rowData, 'up')}
      onMoveDown={() => opts.onReorderItem?.(rowData, 'down')}
      onRemove={() => opts.onRemoveItem?.(rowData)}
    />
  )
}

function actionColumn(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT> {
  return {
    id: 'actions',
    title: <span className="px-1 font-medium">Akcje</span>,
    basis: 64,
    grow: 0,
    shrink: 0,
    minWidth: 64,
    maxWidth: 64,
    disabled: true,
    component: ({ rowData }) => <RowActionsCell rowData={rowData} opts={opts} />,
  }
}

// Every data column in sheet order, before any hiding. Split out from buildV2Columns so the picker
// can enumerate what EXISTS while the grid renders what's visible — one list, no second registry of
// "which columns are there in this view" to drift.
function assembleV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  const { stages, view } = opts
  // Client view: a simple editable price. Subcontractor views: a "Źródło ceny" column (override)
  // + "Cena" showing the derived/override price.
  const priceCols: Column<KosztorysV2RowT>[] =
    view === 'client'
      ? [
          keyCol('clientPrice', floatColumnLeft, {
            id: 'price',
            title: title('price', COLUMN_LABELS.price, opts),
            minWidth: 90,
          }),
        ]
      : [
          subcontractorModeColumn(view, title('priceMode', COLUMN_LABELS.priceMode, opts, false)),
          subcontractorCoeffColumn(
            view,
            title('priceCoeff', COLUMN_LABELS.priceCoeff, opts, false),
          ),
          subcontractorPriceColumn(view, title('price', COLUMN_LABELS.price, opts)),
        ]
  const identity: Column<KosztorysV2RowT>[] = [
    {
      id: 'sectionName',
      title: title('sectionName', COLUMN_LABELS.sectionName, opts),
      minWidth: 140,
      keepFocus: true,
      component: ({ rowData }: CellProps<KosztorysV2RowT, unknown>) => (
        <SectionNameCell rowData={rowData} onRename={opts.onRenameSection} />
      ),
      copyValue: ({ rowData }) => rowData.sectionName ?? '',
      // Delete on a selected Sekcja cell is a no-op — an accidental keypress must not blank a whole
      // section. Only an explicit in-cell clear-and-commit renames it.
      deleteValue: ({ rowData }) => rowData,
    },
    keyCol('description', textColumn, {
      id: 'description',
      title: title('description', COLUMN_LABELS.description, opts),
      minWidth: 240,
      grow: 2,
    }),
  ]

  const measure: Column<KosztorysV2RowT>[] = [
    keyCol('plannedQty', floatColumnLeft, {
      id: 'plannedQty',
      title: title('plannedQty', COLUMN_LABELS.plannedQty, opts),
      minWidth: 90,
    }),
    {
      ...computedColumn('stageQtySum', title('stageQtySum', COLUMN_LABELS.stageQtySum, opts), (r) =>
        rowTotalQtyDone(r, stages),
      ),
      minWidth: 90,
    },
    unitColumn(title('unit', COLUMN_LABELS.unit, opts)),
  ]

  const pricing: Column<KosztorysV2RowT>[] = [
    ...priceCols,
    computedColumn('priceGross', title('priceGross', COLUMN_LABELS.priceGross, opts), (r) =>
      toGross(viewPrice(r, view), r.vatRate),
    ),
    discountValueColumn(title('discountValue', COLUMN_LABELS.discountValue, opts)),
    discountTypeColumn(title('discountType', COLUMN_LABELS.discountType, opts)),
    computedColumn(
      'discountAmount',
      title('discountAmount', COLUMN_LABELS.discountAmount, opts),
      (r) => rowDiscountForView(r, rowTotalQtyDone(r, stages), view),
    ),
    computedColumn(
      'discountAmountGross',
      title('discountAmountGross', COLUMN_LABELS.discountAmountGross, opts),
      (r) => toGross(rowDiscountForView(r, rowTotalQtyDone(r, stages), view), r.vatRate),
    ),
  ]

  const stageCols: Column<KosztorysV2RowT>[] = stages.map((st) =>
    keyCol(stageKey(st.id), floatColumnLeft, {
      id: stageKey(st.id),
      title: (
        <StageHeader
          stage={st}
          onRename={opts.onRenameStage}
          onRemove={opts.onRemoveStage}
          tip={HEADER_TIPS[STAGES_COLUMN_GROUP]}
        />
      ),
      minWidth: 80,
    }),
  )

  // The sheet's V–AE: the value of each stage's recorded qty at the view's price, post-discount.
  // Computed at render, never a row field — hence the separate id namespace (constants.ts).
  const stageValueNetCols: Column<KosztorysV2RowT>[] = stages.map((st) => {
    const qtyKey = stageKey(st.id)
    return computedColumn(
      stageValueNetKey(st.id),
      stageValueHeader(st, 'netto', HEADER_TIPS[STAGE_VALUE_NET_COLUMN_GROUP]),
      (r) => stageValueForView(r, r[qtyKey] ?? 0, rowTotalQtyDone(r, stages), view),
    )
  })

  const stageValueGrossCols: Column<KosztorysV2RowT>[] = stages.map((st) => {
    const qtyKey = stageKey(st.id)
    return computedColumn(
      stageValueGrossKey(st.id),
      stageValueHeader(st, 'brutto', HEADER_TIPS[STAGE_VALUE_GROSS_COLUMN_GROUP]),
      (r) =>
        toGross(stageValueForView(r, r[qtyKey] ?? 0, rowTotalQtyDone(r, stages), view), r.vatRate),
    )
  })

  // The percent reading of the same stage block: one column per stage instead of the netto/brutto
  // pair, since a percentage is the same figure on either side of the VAT.
  const stageValuePercentCols: Column<KosztorysV2RowT>[] = stages.map((st) => {
    const qtyKey = stageKey(st.id)
    return computedColumn(
      stageValuePercentKey(st.id),
      stageValueHeader(st, '%', HEADER_TIPS[STAGE_VALUE_PERCENT_COLUMN_GROUP]),
      (r) => stageDoneFraction(r, r[qtyKey] ?? 0),
      'text-muted-foreground',
      formatPercent,
    )
  })

  // The row's headline figure — available in both display modes, hence untagged: it answers "how far
  // along is this position", which the money columns never say outright.
  const donePercent: Column<KosztorysV2RowT>[] = [
    computedColumn(
      'donePercent',
      title('donePercent', COLUMN_LABELS.donePercent, opts),
      (r) => rowDoneFraction(r, rowTotalQtyDone(r, stages)),
      // Red = more was executed than was offered. The percentage says so too (>100%), but only this
      // cell says it at a glance across a thousand rows.
      (r) =>
        hasStagesOverPlanned(r, stages)
          ? 'text-destructive font-medium'
          : 'text-muted-foreground font-medium',
      formatPercent,
    ),
  ]

  const computed: Column<KosztorysV2RowT>[] = [
    computedColumn('plannedNet', title('plannedNet', COLUMN_LABELS.plannedNet, opts), (r) =>
      rowPlannedNetForView(r, view),
    ),
    computedColumn('plannedGross', title('plannedGross', COLUMN_LABELS.plannedGross, opts), (r) =>
      toGross(rowPlannedNetForView(r, view), r.vatRate),
    ),
    computedColumn(
      'net',
      title('net', COLUMN_LABELS.net, opts),
      (r) => rowValueForView(r, stages, view),
      'text-muted-foreground font-medium',
    ),
    computedColumn('gross', title('gross', COLUMN_LABELS.gross, opts), (r) =>
      toGross(rowValueForView(r, stages, view), r.vatRate),
    ),
  ]

  // Komentarz (sheet col T): the row's free-text note. Plain text column — the `note` field is
  // already diffed/persisted; this only surfaces it in the grid.
  const komentarz: Column<KosztorysV2RowT>[] = [
    keyCol('note', textColumn, {
      id: 'note',
      title: title('note', COLUMN_LABELS.note, opts, false),
      minWidth: 200,
      grow: 1,
    }),
  ]

  const remaining: Column<KosztorysV2RowT>[] = [
    computedColumn('remaining', title('remaining', COLUMN_LABELS.remaining, opts), (r) =>
      rowRemainingForView(r, stages, view),
    ),
    computedColumn(
      'remainingGross',
      title('remainingGross', COLUMN_LABELS.remainingGross, opts),
      // The dash must survive the VAT step: toGross(null) would read 0 — "settled" — on a row that
      // has no przedmiar to settle against.
      (r) => {
        const net = rowRemainingForView(r, stages, view)
        return net === null ? null : toGross(net, r.vatRate)
      },
    ),
  ]

  // Both blocks keep sheet order: the stage qty columns lead (the sheet's D–M), then Przedmiar (N)
  // and Pomiar z natury (O), then the value block (V–AE right before AF "pozostało"). The row-actions
  // column leads the whole grid when editing is enabled — it rides the same assemble→hide→toggle
  // pipeline as every data column (no special-casing), so the picker can hide it like any other.
  const dataColumns = [
    ...identity,
    ...stageCols,
    ...measure,
    ...pricing,
    ...computed,
    ...stageValueNetCols,
    ...stageValueGrossCols,
    ...stageValuePercentCols,
    ...donePercent,
    ...remaining,
    ...komentarz,
  ]
  return opts.onRemoveItem || opts.onReorderItem
    ? [actionColumn(opts), ...dataColumns]
    : dataColumns
}

// A stage column answers to its axis's shared "Etapy — …" picker entry, not to its own id. The three
// prefixes are mutually exclusive (none is a prefix of another), so the order of these tests carries
// no meaning — the qty prefix last is not load-bearing.
function toggleKey(columnId: string): string {
  if (columnId.startsWith(`${STAGE_VALUE_NET_COLUMN_GROUP}_`)) return STAGE_VALUE_NET_COLUMN_GROUP
  if (columnId.startsWith(`${STAGE_VALUE_GROSS_COLUMN_GROUP}_`)) {
    return STAGE_VALUE_GROSS_COLUMN_GROUP
  }
  if (columnId.startsWith(`${STAGE_VALUE_PERCENT_COLUMN_GROUP}_`)) {
    return STAGE_VALUE_PERCENT_COLUMN_GROUP
  }
  return columnId.startsWith(STAGE_QTY_PREFIX) ? STAGES_COLUMN_GROUP : columnId
}

// Hide/axis/resize selection over an already-assembled column list. Split from the assembly so the
// grid and the picker can share ONE assembleV2Columns pass (buildV2Grid) instead of two.
function selectV2Columns(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT>[] {
  const axis = opts.moneyAxis ?? MONEY_AXIS_DEFAULT
  const display = opts.progressDisplay ?? PROGRESS_DISPLAY_DEFAULT
  const layer = opts.layer ?? LAYER_DEFAULT
  const base = assembled
    .filter((c) => {
      const key = toggleKey(c.id ?? '')
      if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(key)) return false
      return (
        !opts.isHidden?.(key) &&
        axisAllows(key, axis) &&
        progressDisplayAllows(key, display) &&
        layerAllows(key, layer)
      )
    })
    .map((c) => withResize(c, opts))
  return markLayerBoundary(base)
}

// A narrow, non-editable empty column — the visible gap between the „Praca" and „Postęp" blocks.
const layerGapColumn: Column<KosztorysV2RowT> = {
  id: 'layerGap',
  title: <span />,
  basis: 24,
  grow: 0,
  shrink: 0,
  minWidth: 24,
  maxWidth: 24,
  disabled: true,
  headerClassName: 'border-l border-border',
  cellClassName: 'border-l border-border',
  component: () => null,
}

// Divider between the work-layer block and the progress-layer block: an empty gap column at the first
// visible progress column, so the eye sees where „Praca" ends and „Postęp" begins. Derived from the
// filtered list (not a fixed index) so it lands correctly whatever the money/etapy axes have hidden.
function markLayerBoundary(columns: Column<KosztorysV2RowT>[]): Column<KosztorysV2RowT>[] {
  const first = columns.findIndex((c) => COLUMN_LAYER[toggleKey(c.id ?? '')] === 'progress')
  if (first <= 0) return columns
  return [...columns.slice(0, first), layerGapColumn, ...columns.slice(first)]
}

// Picker entries for the columns this view actually has, in grid order. Stage columns collapse into
// their axis's "Etapy — …" entry — hence the dedupe.
function selectV2ToggleItems(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): ColumnToggleItemT[] {
  const items: ColumnToggleItemT[] = []
  for (const col of assembled) {
    const id = toggleKey(col.id ?? '')
    if (items.some((i) => i.id === id)) continue
    if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(id)) continue
    items.push({ id, label: COLUMN_LABELS[id] ?? id, visible: !opts.isHidden?.(id) })
  }
  return items
}

// Columns-only assemble — the grid path goes through buildV2Grid; kept for the column-set unit specs
// (money-axis / layer), which assert which ids survive a predicate without the picker.
export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  return selectV2Columns(assembleV2Columns(opts), opts)
}

// The grid + its picker in one assembly pass — assembleV2Columns is the O(columns·stages) build, so
// it runs once and returns both instead of once per export.
export function buildV2Grid(opts: BuildV2ColumnsOptsT): {
  columns: Column<KosztorysV2RowT>[]
  columnToggleItems: ColumnToggleItemT[]
} {
  const assembled = assembleV2Columns(opts)
  return {
    columns: selectV2Columns(assembled, opts),
    columnToggleItems: selectV2ToggleItems(assembled, opts),
  }
}
