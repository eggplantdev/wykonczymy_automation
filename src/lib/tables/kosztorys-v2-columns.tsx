'use client'

import { type ReactNode } from 'react'
import { Column, type CellProps, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/kosztorys/cell-select-menu'
import { SortHeader } from '@/components/kosztorys/sort-header'
import { StageHeader } from '@/components/kosztorys/stage-header'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysRowActionsMenu } from '@/components/kosztorys/kosztorys-row-actions-menu'
import { ResizableHeader } from '@/components/kosztorys/column-resize-handle'
import {
  rowNetForView,
  rowRemainingForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { Combobox } from '@/components/ui/combobox'
import { UNIT_SUGGESTIONS } from '@/lib/kosztorys/constants'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import { rowDoneNetForView, stageKey, type SortDirT } from '@/lib/kosztorys/v2-rows'
import type {
  DiscountTypeT,
  KosztorysStageT,
  KosztorysV2RowT,
  SubcontractorOverrideTypeT,
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
  { value: 'percent', label: 'Procent (%)' },
  { value: 'amount', label: 'Kwota (zł)' },
]

// Where the subcontractor price comes from (a column in the subcontractor views). Labels name the
// SOURCE of the multiplier, not the arithmetic: auto and 'coeff' both compute clientPrice × n and
// differ only in whether n is inherited — labels describing the maths read as synonyms.
// No effective value in the 'auto' label: these options are shared by every row, so a literal
// number here would misreport rows whose section overrides the investment default.
const SUB_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'auto (domyślny mnożnik)' },
  { value: 'coeff', label: 'własny mnożnik' },
  { value: 'amount', label: 'kwota stała' },
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
  // Stages (etapy) render as dynamic editable columns; a trailing "Pozostało" reads out the
  // remaining net. The set drives the columns, so the editor MUST include it in the grid remount
  // key (dsg freezes columns at mount) — otherwise a new stage never gets a column.
  stages: KosztorysStageT[]
  onRemoveStage?: (stageId: number) => void
  onRenameStage?: (stageId: number, label: string) => void
  sort?: V2SortStateT
  onSetSort?: (field: string, dir: SortDirT | null) => void
  // Resize: pinned column widths (id→px) + drag callbacks. When provided, every column
  // gets a handle; pinned ones get basis/grow:0 (the rest stay on flex).
  widths?: Record<string, number>
  onGuide?: (x: number | null) => void
  onCommitColumn?: (id: string, width: number) => void
  // Row actions: removing an item + reading a section's item count (to enforce the
  // "≥1 item" invariant). Both read fresh state from the editor (ref) — because dsg freezes
  // `columns` at mount, so the closure MUST read current data, not a snapshot from mount.
  onRemoveItem?: (row: KosztorysV2RowT) => void
  // Reason the row's delete is blocked (disabled + tooltip), or undefined if removable.
  getRemoveBlockReason?: (row: KosztorysV2RowT) => string | undefined
  // Reordering items within a section (Przesuń w górę/dół). Reads fresh `rows` from the editor
  // (ref) — because dsg freezes `columns` at mount. Greyed out while a column sort is active.
  onReorderItem?: (row: KosztorysV2RowT, dir: 'up' | 'down') => void
  // The section panel overlays the grid's right edge, so the columns under it are unreachable.
  // While it's open we append a spacer column of exactly its width — the only scrollable slack
  // that lets the last real column travel out from under it.
  summaryOpen?: boolean
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

// Audit aid (may be temporary): each header explains the column's intent + the formula that
// drives it, so mismatches between intent and calc are visible. Netto/wartości liczone są z
// POMIARU (measuredQty); PRZEDMIAR (plannedQty) nie wchodzi obecnie do żadnego obliczenia.
const HEADER_TIP_DELAY = 600

const HEADER_TIPS: Record<string, string> = {
  sectionName:
    'Sekcja — nazwa sekcji kosztorysu.\nTylko do odczytu (zmieniana z panelu sekcji). Wartość zdenormalizowana na każdym wierszu.',
  description: 'Opis — nazwa/opis pozycji robót lub materiału. Nie wchodzi do obliczeń.',
  unit: 'J.m. — jednostka miary (m², szt., mb…). Etykieta, nie wchodzi do obliczeń.',
  plannedQty:
    'Przedmiar — ilość planowana (z przedmiaru/oferty).\nPole informacyjne — z założenia nie wchodzi do obliczeń. Netto liczone jest z Pomiaru.',
  measuredQty:
    'Pomiar — ilość zmierzona / rzeczywista.\nTo ona napędza wszystkie wartości: Netto = Pomiar × Cena − Rabat.',
  price: 'Cena — cena jednostkowa przy aktywnym widoku cen (klient lub podwykonawca).',
  priceMode:
    'Źródło ceny wykonawcy — skąd bierze się mnożnik.\n\nAuto = mnożnik dziedziczony: z sekcji, a gdy nieustawiony — domyślny z inwestycji.\nWłasny mnożnik = mnożnik wpisany w tym wierszu.\nKwota stała = cena wpisana wprost, nie podąża za Ceną klienta.\n\nAuto i własny mnożnik liczą tak samo (Cena klienta × mnożnik) — różni je tylko pochodzenie mnożnika.',
  discountType: 'Rabat — typ rabatu: — brak · % procent · zł kwota.',
  discountValue:
    'Rabat wart. — wartość rabatu.\nDla % = punkty procentowe (10 = 10%); dla zł = kwota odjęta od Netto.',
  net: 'Netto = Pomiar × Cena − Rabat. Wartość pozycji przy aktywnym widoku cen.',
  gross: 'Brutto = Netto × (1 + VAT). Jedna stawka VAT na inwestycję, zdenormalizowana na wierszu.',
  remaining:
    'Pozostało = Netto − suma wartości ukończonych etapów.\nIle z wartości pozycji nie zostało jeszcze rozliczone etapami.',
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
  if (!tip) return node
  return (
    <SimpleTooltip
      content={tip}
      delayDuration={HEADER_TIP_DELAY}
      className="max-w-xs whitespace-pre-line"
    >
      <span className="flex h-full w-full items-center">{node}</span>
    </SimpleTooltip>
  )
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
      <span className={`block w-full px-2 text-left ${className}`}>{fmt(compute(rowData))}</span>
    ),
  }
}

// Discount-type select cell (—/%/zł). setRowData feeds the diff → autosave.
function DiscountTypeCell({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) {
  return (
    <CellSelectMenu
      value={rowData.discountType ?? ''}
      options={DISCOUNT_OPTIONS}
      hideChevron
      onChange={(next) =>
        setRowData({ ...rowData, discountType: (next || null) as DiscountTypeT | null })
      }
    />
  )
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
          className={`size-full bg-transparent px-2 text-left text-sm outline-none ${derived ? 'text-muted-foreground italic' : ''}`}
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

// Switching to auto zeroes the override value.
function subcontractorModeColumn(
  view: 'w_tools' | 'own_tools',
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'priceMode',
    title: titleNode,
    // Fits the header label next to the sort icon — below this the title truncates.
    minWidth: 185,
    keepFocus: true,
    component: ({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) => (
      <CellSelectMenu
        value={(rowData[typeField] as string | null) ?? ''}
        options={SUB_MODE_OPTIONS}
        onChange={(value) => {
          const next = (value || null) as SubcontractorOverrideTypeT | null
          setRowData({
            ...rowData,
            [typeField]: next,
            ...(next === null ? { [valueField]: 0 } : {}),
          })
        }}
      />
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

// Width MUST track KosztorysSectionSummary's `w-72`: the spacer's job is to reserve the panel's
// exact footprint, so a narrower one leaves a column stranded underneath.
const SUMMARY_PANEL_WIDTH = 288

const spacerColumn: Column<KosztorysV2RowT> = {
  id: 'summarySpacer',
  title: '',
  basis: SUMMARY_PANEL_WIDTH,
  grow: 0,
  shrink: 0,
  minWidth: SUMMARY_PANEL_WIDTH,
  maxWidth: SUMMARY_PANEL_WIDTH,
  disabled: true,
  component: () => null,
}

export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  const { stages, view } = opts
  // Client view: a simple editable price. Subcontractor views: a "Tryb" column (override)
  // + "Cena" showing the derived/override price. (Remount on `view` in the editor — dsg freezes
  // columns at mount; see the lesson in lessons.md.)
  const priceCols: Column<KosztorysV2RowT>[] =
    view === 'client'
      ? [
          keyCol('clientPrice', floatColumnLeft, {
            id: 'price',
            title: title('price', 'Cena', opts),
            minWidth: 90,
          }),
        ]
      : [
          subcontractorModeColumn(view, title('priceMode', 'Źródło ceny wykonawcy', opts)),
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
      title: title('description', 'Opis prac', opts),
      minWidth: 240,
      grow: 2,
    }),
    unitColumn(title('unit', 'J.m.', opts)),
    keyCol('plannedQty', floatColumnLeft, {
      id: 'plannedQty',
      title: title('plannedQty', 'Przedmiar', opts),
      minWidth: 90,
    }),
    keyCol('measuredQty', floatColumnLeft, {
      id: 'measuredQty',
      title: title('measuredQty', 'Pomiar', opts),
      minWidth: 90,
    }),
    ...priceCols,
    discountTypeColumn(title('discountType', 'Rabat', opts)),
    keyCol('discountValue', floatColumnLeft, {
      id: 'discountValue',
      title: title('discountValue', 'Rabat wart.', opts),
      minWidth: 80,
    }),
  ]

  const stageCols: Column<KosztorysV2RowT>[] = stages.map((st) =>
    keyCol(stageKey(st.id), floatColumnLeft, {
      id: stageKey(st.id),
      title: (
        <StageHeader
          stage={st}
          onRename={opts.onRenameStage}
          onRemove={opts.onRemoveStage}
          tip={
            'Etap — ilość wykonana w tym etapie (wpisywana w wierszu).\nWartość etapu = ilość × Cena − Rabat. Suma ukończonych etapów pomniejsza kolumnę Pozostało.'
          }
        />
      ),
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
    computedColumn(
      'gross',
      title('gross', 'Brutto', opts),
      (r) => rowNetForView(r as unknown as ViewPricingT, view) * (1 + r.vatRate),
    ),
    computedColumn('remaining', title('remaining', 'Pozostało', opts), (r) =>
      rowRemainingForView(r as unknown as ViewPricingT, rowDoneNetForView(r, stages, view), view),
    ),
  ]

  // The spacer stays outside `withResize` — it isn't a real column and must not get a drag handle.
  const base = [...left, ...stageCols, ...computed].map((c) => withResize(c, opts))
  const withSpacer = opts.summaryOpen ? [...base, spacerColumn] : base
  return opts.onRemoveItem || opts.onReorderItem ? [actionColumn(opts), ...withSpacer] : withSpacer
}
