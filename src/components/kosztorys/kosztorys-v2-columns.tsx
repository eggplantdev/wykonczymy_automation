'use client'

import { type ReactNode, useRef, useState } from 'react'
import { Column, type CellProps, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/kosztorys/cell-select-menu'
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
import { Combobox } from '@/components/ui/combobox'
import { discountFromType, discountFromValue } from '@/lib/kosztorys/discount-edit'
import { type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import {
  COLUMN_LABELS,
  NON_HIDEABLE_COLUMNS,
  STAGE_QTY_PREFIX,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_PERCENT_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
  UNIT_SUGGESTIONS,
  stageKey,
  stageValueGrossKey,
  stageValueNetKey,
  stageValuePercentKey,
} from '@/lib/kosztorys/constants'
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
import type {
  DiscountTypeT,
  KosztorysStageT,
  KosztorysV2RowT,
  ViewPricingT,
} from '@/types/kosztorys'

// floatColumn right-aligns by default; the grid reads cleaner with every cell left-aligned under
// its (left-aligned) header, so numbers don't float at the far edge of wide columns.
const floatColumnLeft = {
  ...floatColumn,
  columnData: { ...floatColumn.columnData, alignRight: false },
}

const DISCOUNT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Bez rabatu' },
  { value: 'percent', label: '%' },
  { value: 'amount', label: 'zł' },
]

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
function title(field: string, label: string, opts: BuildV2ColumnsOptsT): ReactNode {
  const active = opts.sort?.field === field ? opts.sort.dir : null
  const tip = HEADER_TIPS[field]
  // The tip goes ONTO the sort trigger (same element), not around it — a second wrapping trigger
  // would fight the dropdown for the click. Plain-label columns have no trigger, so wrap directly.
  if (opts.onSetSort) {
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
// Deliberately not `title(...)` — sort is wired only for price/net/remaining (see sortValue in
// use-kosztorys-editor), so a sort trigger here would render an arrow that does nothing. Deliberately
// not `StageHeader` — a mirror carries no rename/delete affordance of its own.
function stageValueHeader(stage: KosztorysStageT, suffix: string, tip: string): ReactNode {
  // truncate, not wrap: the label is the user's free text and the suffix trails it, so an
  // unbounded header would push the row's height around as stages get renamed.
  return withTip(
    <span className="truncate text-sm">{`${stage.label || `Etap ${stage.ordinal}`} — ${suffix}`}</span>,
    tip,
  )
}

// Discount-type select cell (—/%/zł). setRowData feeds the diff → autosave.
// The type/value transitions live in discount-edit.ts — see there for why they're paired.
function DiscountTypeCell({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) {
  return (
    <CellSelectMenu
      value={rowData.discountType ?? ''}
      options={DISCOUNT_OPTIONS}
      hideChevron
      onChange={(next) =>
        setRowData({
          ...rowData,
          ...discountFromType(rowData, (next || null) as DiscountTypeT | null),
        })
      }
    />
  )
}

// Discount-value cell: a hand-rolled input rather than floatColumn, because an edit here has to
// reach discountType too (discount-edit.ts), which a keyColumn can't do.
function DiscountValueCell({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) {
  return (
    <input
      className="size-full bg-transparent px-2 text-left text-sm outline-none"
      value={String(rowData.discountValue ?? '')}
      inputMode="decimal"
      onChange={(e) => {
        const next = discountFromValue(rowData, e.target.value)
        if (next) setRowData({ ...rowData, ...next })
      }}
    />
  )
}

function discountValueColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'discountValue',
    title: titleNode,
    minWidth: 80,
    keepFocus: true,
    component: DiscountValueCell,
    copyValue: ({ rowData }) => String(rowData.discountValue ?? ''),
    deleteValue: ({ rowData }) => ({ ...rowData, discountType: null, discountValue: 0 }),
  }
}

// Unit (j.m.) creatable combobox cell: pick a canonical unit or type a custom one.
// setRowData feeds the diff → autosave.
function UnitCell({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) {
  return (
    <Combobox
      value={rowData.unit ?? ''}
      onChange={(next) => setRowData({ ...rowData, unit: next || null })}
      options={UNIT_SUGGESTIONS}
      allowCustom
      hideChevron
      className="hover:bg-accent size-full cursor-pointer px-2"
    />
  )
}

function unitColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'unit',
    title: titleNode,
    minWidth: 64,
    component: UnitCell,
    keepFocus: true,
    copyValue: ({ rowData }) => rowData.unit ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, unit: null }),
    pasteValue: ({ rowData, value }) => ({ ...rowData, unit: value.trim() || null }),
  }
}

// Section-name cell: renames the WHOLE section, so it commits through opts.onRenameSection (the same
// fan-out the section panel uses) — never setRowData, which would rewrite only this row's copy of the
// denormalized name. Local draft while editing; the row's canonical value shows otherwise, so an
// external rename (from the panel) is reflected without a mount-time snapshot going stale. Enter/blur
// commit, Escape reverts. A stray grid Delete is a no-op (deleteValue returns the row) so it can't
// blank the section.
function SectionNameCell({
  rowData,
  opts,
}: {
  rowData: KosztorysV2RowT
  opts: BuildV2ColumnsOptsT
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  // Escape sets this before blur so the shared onBlur commit knows to skip the rename.
  const cancelRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <input
      ref={inputRef}
      className="size-full bg-transparent px-2 text-left text-sm outline-none"
      value={editing ? draft : (rowData.sectionName ?? '')}
      onFocus={() => {
        cancelRef.current = false
        setDraft(rowData.sectionName ?? '')
        setEditing(true)
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (editing && !cancelRef.current) opts.onRenameSection?.(rowData.sectionId, draft)
        setEditing(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          inputRef.current?.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          cancelRef.current = true
          inputRef.current?.blur()
        }
      }}
    />
  )
}

function discountTypeColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'discountType',
    title: titleNode,
    minWidth: 110,
    component: DiscountTypeCell,
    keepFocus: true,
    copyValue: ({ rowData }) => rowData.discountType ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, discountType: null }),
    pasteValue: ({ rowData, value }) => ({
      ...rowData,
      discountType: (value === 'percent' || value === 'amount'
        ? value
        : null) as DiscountTypeT | null,
    }),
  }
}

// Applies a pinned width (basis/grow:0) to a column and wraps its title in a resize handle.
// Without the drag callbacks (onResizeColumn) it returns the column unchanged — resize disabled.
function withResize(
  col: Column<KosztorysV2RowT>,
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT> {
  if (!opts.onGuide || !opts.onCommitColumn || !col.id) return col
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
  const removeBlockReason = opts.getRemoveBlockReason?.(rowData)

  return (
    <KosztorysRowActionsMenu
      sortActive={sortActive}
      removeBlockReason={removeBlockReason}
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
          subcontractorModeColumn(view, title('priceMode', COLUMN_LABELS.priceMode, opts)),
          subcontractorCoeffColumn(view, title('priceCoeff', COLUMN_LABELS.priceCoeff, opts)),
          subcontractorPriceColumn(view, title('price', COLUMN_LABELS.price, opts)),
        ]
  const identity: Column<KosztorysV2RowT>[] = [
    {
      id: 'sectionName',
      title: title('sectionName', COLUMN_LABELS.sectionName, opts),
      minWidth: 140,
      keepFocus: true,
      component: ({ rowData }: CellProps<KosztorysV2RowT, unknown>) => (
        <SectionNameCell rowData={rowData} opts={opts} />
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
      toGross(viewPrice(r as unknown as ViewPricingT, view), r.vatRate),
    ),
    discountValueColumn(title('discountValue', COLUMN_LABELS.discountValue, opts)),
    discountTypeColumn(title('discountType', COLUMN_LABELS.discountType, opts)),
    computedColumn(
      'discountAmount',
      title('discountAmount', COLUMN_LABELS.discountAmount, opts),
      (r) => rowDiscountForView(r as unknown as ViewPricingT, rowTotalQtyDone(r, stages), view),
    ),
    computedColumn(
      'discountAmountGross',
      title('discountAmountGross', COLUMN_LABELS.discountAmountGross, opts),
      (r) =>
        toGross(
          rowDiscountForView(r as unknown as ViewPricingT, rowTotalQtyDone(r, stages), view),
          r.vatRate,
        ),
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
      (r) => stageDoneFraction(r as unknown as ViewPricingT, r[qtyKey] ?? 0),
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
      (r) => rowDoneFraction(r as unknown as ViewPricingT, rowTotalQtyDone(r, stages)),
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
      rowPlannedNetForView(r as unknown as ViewPricingT, view),
    ),
    computedColumn('plannedGross', title('plannedGross', COLUMN_LABELS.plannedGross, opts), (r) =>
      toGross(rowPlannedNetForView(r as unknown as ViewPricingT, view), r.vatRate),
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
  // and Pomiar z natury (O), then the value block (V–AE right before AF "pozostało").
  return [
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
  ]
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
  return opts.onRemoveItem || opts.onReorderItem ? [actionColumn(opts), ...base] : base
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
    if (NON_HIDEABLE_COLUMNS.has(id) || items.some((i) => i.id === id)) continue
    if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(id)) continue
    items.push({ id, label: COLUMN_LABELS[id] ?? id, visible: !opts.isHidden?.(id) })
  }
  return items
}

export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  return selectV2Columns(assembleV2Columns(opts), opts)
}

export function buildV2ToggleItems(opts: BuildV2ColumnsOptsT): ColumnToggleItemT[] {
  return selectV2ToggleItems(assembleV2Columns(opts), opts)
}

// The grid + its picker in one assembly pass — assembleV2Columns is the O(columns·stages) build, and
// running it twice per render (once per export) was pure waste. Callers that need only one still use
// the single-purpose exports above.
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
