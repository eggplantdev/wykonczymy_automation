'use client'

import { useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Column, type CellProps, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'
import { SortHeader } from '@/components/kosztorys/sort-header'
import { StageHeader } from '@/components/kosztorys/stage-header'
import { KosztorysRowActionsMenu } from '@/components/kosztorys/kosztorys-row-actions-menu'
import { ResizableHeader } from '@/components/kosztorys/column-resize-handle'
import {
  rowNetForView,
  rowRemainingForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import { rowDoneNetForView, stageKey, type SortDirT } from '@/lib/kosztorys/v2-rows'
import type {
  DiscountTypeT,
  KosztorysStageT,
  KosztorysV2RowT,
  SubcontractorOverrideTypeT,
  ViewPricingT,
} from '@/types/kosztorys'

const DISCOUNT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'percent', label: '%' },
  { value: 'amount', label: 'zł' },
]

// Subcontractor price calculation mode (a column in the subcontractor views). Descriptive
// labels — the model is non-obvious (an explanation above the table is a UX follow-up).
const SUB_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'auto (z współczynnika)' },
  { value: 'coeff', label: '× mnożnik ceny klienta' },
  { value: 'amount', label: 'kwota zł' },
]

const OVERRIDE_FIELDS: Record<
  'w_tools' | 'own_tools',
  { type: keyof KosztorysV2RowT; value: keyof KosztorysV2RowT }
> = {
  w_tools: { type: 'wToolsOverrideType', value: 'wToolsOverrideValue' },
  own_tools: { type: 'ownToolsOverrideType', value: 'ownToolsOverrideValue' },
}

export type V2SortStateT = { field: string; dir: SortDirT } | null

export type BuildV2ColumnsOptsT = {
  view: PriceViewT
  // Brutto is a read-only per-row column (net × (1 + vatRate)) shown only when toggled on. The
  // editor MUST include this flag in the grid remount key — dsg freezes columns at mount, so a
  // toggle would otherwise never add/remove the column.
  bruttoVisible: boolean
  // Stages (etapy) render as dynamic editable columns; a trailing "Pozostało" reads out the
  // remaining net. The set drives the columns, so the editor MUST include it in the grid remount
  // key (dsg freezes columns at mount) — otherwise a new stage never gets a column.
  stages: KosztorysStageT[]
  onRemoveStage?: (stageId: number) => void
  onRenameStage?: (stageId: number, label: string) => void
  sort?: V2SortStateT
  onToggleSort?: (field: string) => void
  // Resize: pinned column widths (id→px) + drag callbacks. When provided, every column
  // gets a handle; pinned ones get basis/grow:0 (the rest stay on flex).
  widths?: Record<string, number>
  onGuide?: (x: number | null) => void
  onCommitColumn?: (id: string, width: number) => void
  // Row actions: removing an item + reading a section's item count (to enforce the
  // "≥1 item" invariant). Both read fresh state from the editor (ref) — because dsg freezes
  // `columns` at mount, so the closure MUST read current data, not a snapshot from mount.
  onRemoveItem?: (row: KosztorysV2RowT) => void
  getSectionItemCount?: (sectionId: number) => number
  // Reordering items within a section (Przesuń w górę/dół). Reads fresh `rows` from the editor
  // (ref) — because dsg freezes `columns` at mount. Greyed out while a column sort is active.
  onReorderItem?: (row: KosztorysV2RowT, dir: 'up' | 'down') => void
  // Inserting a blank item above/below the row within its section. Same fresh-ref, event-time read.
  onInsertItem?: (row: KosztorysV2RowT, dir: 'above' | 'below') => void
}

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

// Column title as a clickable sorting header (when onToggleSort is provided).
function title(field: string, label: string, opts: BuildV2ColumnsOptsT): ReactNode {
  if (!opts.onToggleSort) return label
  const active = opts.sort?.field === field ? opts.sort.dir : null
  return <SortHeader label={label} active={active} onToggle={() => opts.onToggleSort?.(field)} />
}

// Computed, read-only column: a custom component rendering the value from calc.
function computedColumn(
  id: string,
  titleNode: ReactNode,
  compute: (r: KosztorysV2RowT) => number,
  className = 'text-muted-foreground',
): Column<KosztorysV2RowT> {
  return {
    id,
    title: titleNode,
    disabled: true,
    component: ({ rowData }) => (
      <span className={`block w-full pr-2 text-right ${className}`}>{fmt(compute(rowData))}</span>
    ),
  }
}

// Discount-type select cell (—/%/zł). setRowData feeds the diff → autosave.
function DiscountTypeCell({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) {
  return (
    <select
      className="size-full bg-transparent px-2 text-sm outline-none"
      value={rowData.discountType ?? ''}
      onChange={(e) =>
        setRowData({
          ...rowData,
          discountType: (e.target.value || null) as DiscountTypeT | null,
        })
      }
    >
      {DISCOUNT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function discountTypeColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'discountType',
    title: titleNode,
    minWidth: 70,
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

// The "Cena" column in the subcontractor view: shows either the derived price (greyed out when
// the override is null) or the entered override value. Entering a value while in the null state
// creates an 'amount' (flat) override; clearing it reverts to the derived price (null). The
// coeff vs amount mode is set by a separate "Tryb" column.
function subcontractorPriceColumn(
  view: 'w_tools' | 'own_tools',
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'price',
    title: titleNode,
    minWidth: 90,
    keepFocus: true,
    component: ({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) => {
      const type = rowData[typeField] as SubcontractorOverrideTypeT | null
      const derived = type == null
      const price = viewPrice(rowData as unknown as ViewPricingT, view)
      return (
        <input
          className={`size-full bg-transparent px-2 text-right text-sm outline-none ${derived ? 'text-muted-foreground italic' : ''}`}
          value={derived ? '' : String(rowData[valueField] ?? '')}
          placeholder={derived ? fmt(price) : ''}
          inputMode="decimal"
          onChange={(e) => {
            const raw = e.target.value.trim().replace(',', '.')
            if (raw === '') {
              setRowData({ ...rowData, [typeField]: null, [valueField]: 0 })
              return
            }
            const n = Number(raw)
            if (Number.isNaN(n)) return
            setRowData({ ...rowData, [typeField]: type ?? 'amount', [valueField]: n })
          }}
        />
      )
    },
    copyValue: ({ rowData }) => String(viewPrice(rowData as unknown as ViewPricingT, view)),
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}

// The "Tryb" column for the subcontractor price override: auto (null) / × (coeff) / zł (amount).
// Switching to auto zeroes the override value.
function subcontractorModeColumn(
  view: 'w_tools' | 'own_tools',
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'priceMode',
    title: titleNode,
    minWidth: 150,
    keepFocus: true,
    component: ({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) => (
      <select
        className="size-full bg-transparent px-2 text-sm outline-none"
        value={(rowData[typeField] as string | null) ?? ''}
        onChange={(e) => {
          const next = (e.target.value || null) as SubcontractorOverrideTypeT | null
          setRowData({
            ...rowData,
            [typeField]: next,
            ...(next === null ? { [valueField]: 0 } : {}),
          })
        }}
      >
        {SUB_MODE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
    copyValue: ({ rowData }) => (rowData[typeField] as string | null) ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
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

// The ⋯ actions cell: a single button opening KosztorysRowActionsMenu (Wstaw powyżej/poniżej,
// Przesuń w górę/dół, Usuń). Menu open-state is local per cell; the menu portals to body at the
// button's bottom-left. Insert + move are disabled while a column sort is active ("above/up" has
// no mapping in display_order against a price-sorted view); delete is disabled on a section's last
// item (the "≥1 item" invariant). The handlers read fresh editor state via refs (dsg freezes
// `columns` at mount), so a stale closure never fires against the wrong row.
function RowActionsCell({
  rowData,
  opts,
}: {
  rowData: KosztorysV2RowT
  opts: BuildV2ColumnsOptsT
}) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)
  const sortActive = opts.sort != null
  const canRemove = opts.getSectionItemCount
    ? opts.getSectionItemCount(rowData.sectionId) > 1
    : true

  // The button fills the whole cell so the entire actions column is one click target — a small
  // centered icon left most of the cell dead (and dsg still let you select the empty area).
  return (
    <>
      <button
        type="button"
        title="Akcje wiersza"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setMenuPos({ x: r.left, y: r.bottom })
        }}
        className="text-muted-foreground hover:text-foreground hover:bg-accent flex size-full cursor-pointer items-center justify-center"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menuPos && (
        <KosztorysRowActionsMenu
          x={menuPos.x}
          y={menuPos.y}
          sortActive={sortActive}
          canRemove={canRemove}
          onInsertAbove={() => opts.onInsertItem?.(rowData, 'above')}
          onInsertBelow={() => opts.onInsertItem?.(rowData, 'below')}
          onMoveUp={() => opts.onReorderItem?.(rowData, 'up')}
          onMoveDown={() => opts.onReorderItem?.(rowData, 'down')}
          onRemove={() => opts.onRemoveItem?.(rowData)}
          onClose={() => setMenuPos(null)}
        />
      )}
    </>
  )
}

// Action column: a single ⋯ button per row (see RowActionsCell). Rigid 48px, non-resizable.
function actionColumn(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT> {
  return {
    id: 'actions',
    title: '',
    basis: 48,
    grow: 0,
    shrink: 0,
    minWidth: 48,
    maxWidth: 48,
    disabled: true,
    component: ({ rowData }) => <RowActionsCell rowData={rowData} opts={opts} />,
  }
}

export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  const { stages, view } = opts
  // Client view: a simple editable price. Subcontractor views: a "Tryb" column (override)
  // + "Cena" showing the derived/override price. (Remount on `view` in the editor — dsg freezes
  // columns at mount; see the lesson in lessons.md.)
  const priceCols: Column<KosztorysV2RowT>[] =
    view === 'client'
      ? [
          keyCol('clientPrice', floatColumn, {
            id: 'price',
            title: title('price', 'Cena', opts),
            minWidth: 90,
          }),
        ]
      : [
          subcontractorModeColumn(view, title('priceMode', 'Tryb liczenia ceny', opts)),
          subcontractorPriceColumn(view, title('price', 'Cena', opts)),
        ]
  const left: Column<KosztorysV2RowT>[] = [
    keyCol('sectionName', textColumn, {
      id: 'sectionName',
      title: title('sectionName', 'Sekcja', opts),
      minWidth: 140,
      // The section name is changed only from the panel — a per-row edit would change only this
      // row's copy (a denormalized field), not the section. Hence read-only.
      disabled: true,
    }),
    keyCol('description', textColumn, {
      id: 'description',
      title: title('description', 'Opis', opts),
      minWidth: 240,
      grow: 2,
    }),
    keyCol('unit', textColumn, { id: 'unit', title: title('unit', 'J.m.', opts), minWidth: 64 }),
    keyCol('plannedQty', floatColumn, {
      id: 'plannedQty',
      title: title('plannedQty', 'Przedmiar', opts),
      minWidth: 90,
    }),
    keyCol('measuredQty', floatColumn, {
      id: 'measuredQty',
      title: title('measuredQty', 'Pomiar', opts),
      minWidth: 90,
    }),
    ...priceCols,
    discountTypeColumn(title('discountType', 'Rabat', opts)),
    keyCol('discountValue', floatColumn, {
      id: 'discountValue',
      title: title('discountValue', 'Rabat wart.', opts),
      minWidth: 80,
    }),
  ]

  const stageCols: Column<KosztorysV2RowT>[] = stages.map((st) =>
    keyCol(stageKey(st.id), floatColumn, {
      id: stageKey(st.id),
      title: <StageHeader stage={st} onRename={opts.onRenameStage} onRemove={opts.onRemoveStage} />,
      minWidth: 80,
    }),
  )

  const computed: Column<KosztorysV2RowT>[] = [
    computedColumn(
      'net',
      title('net', 'Netto', opts),
      (r) => rowNetForView(r as unknown as ViewPricingT, view),
      'font-medium',
    ),
    // Brutto = net × (1 + vatRate). VAT applies to post-discount net (rowNetForView already
    // subtracts the discount). One rate per investment, denormalized onto every row.
    ...(opts.bruttoVisible
      ? [
          computedColumn(
            'gross',
            title('gross', 'Brutto', opts),
            (r) => rowNetForView(r as unknown as ViewPricingT, view) * (1 + r.vatRate),
          ),
        ]
      : []),
    computedColumn('remaining', title('remaining', 'Pozostało', opts), (r) =>
      rowRemainingForView(r as unknown as ViewPricingT, rowDoneNetForView(r, stages, view), view),
    ),
  ]

  const base = [...left, ...stageCols, ...computed].map((c) => withResize(c, opts))
  return opts.onRemoveItem || opts.onReorderItem ? [actionColumn(opts), ...base] : base
}
