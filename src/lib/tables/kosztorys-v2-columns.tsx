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
  effectiveCoeff,
  rowNetForView,
  rowRemainingForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { Combobox } from '@/components/ui/combobox'
import { type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import {
  COLUMN_LABELS,
  NON_HIDEABLE_COLUMNS,
  STAGES_COLUMN_GROUP,
  UNIT_SUGGESTIONS,
} from '@/lib/kosztorys/constants'
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
const SUB_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'auto' },
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
  // remaining net.
  stages: KosztorysStageT[]
  onRemoveStage?: (stageId: number) => void
  onRenameStage?: (stageId: number, label: string) => void
  sort?: V2SortStateT
  onSetSort?: (field: string, dir: SortDirT | null) => void
  // Column picker: true = the user switched this column off. Keyed by column id, except stage
  // columns, which all answer to STAGES_COLUMN_GROUP.
  isHidden?: (id: string) => boolean
  // Resize: pinned column widths (id→px) + drag callbacks. When provided, every column
  // gets a handle; pinned ones get basis/grow:0 (the rest stay on flex).
  widths?: Record<string, number>
  onGuide?: (x: number | null) => void
  onCommitColumn?: (id: string, width: number) => void
  // Row actions: removing an item + reading a section's item count (to enforce the
  // "≥1 item" invariant).
  onRemoveItem?: (row: KosztorysV2RowT) => void
  // Reason the row's delete is blocked (disabled + tooltip), or undefined if removable.
  getRemoveBlockReason?: (row: KosztorysV2RowT) => string | undefined
  // Reordering items within a section (Przesuń w górę/dół). Greyed out while a column sort is
  // active — "up/down" has no meaning against a price-sorted list.
  onReorderItem?: (row: KosztorysV2RowT, dir: 'up' | 'down') => void
  // Inserting a blank item above/below the row within its section.
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
  price:
    'Cena j.m. — cena jednostkowa przy aktywnym widoku cen (klient lub podwykonawca).\nW widokach wykonawcy edytowalna tylko przy „kwota stała" — w pozostałych trybach jest wyliczana (Cena klienta × Mnożnik).',
  priceCoeff:
    'Mnożnik — przez ile mnożona jest Cena klienta, by dać cenę wykonawcy.\n1 = tyle co Cena klienta · 0.65 = 65% ceny klienta · 1.2 = 120% ceny klienta.\n\nSzary kursywą = dziedziczony (z sekcji, a gdy nieustawiony — domyślny z inwestycji). Wpisanie własnego przestawia wiersz na „własny mnożnik".\n„—" przy „kwota stała": cena jest wpisana wprost, mnożnik się nie stosuje.',
  priceMode:
    'Źródło ceny wykonawcy — skąd bierze się mnożnik.\n\nAuto = mnożnik dziedziczony: z sekcji, a gdy nieustawiony — domyślny z inwestycji.\nWłasny mnożnik = mnożnik wpisany w tym wierszu.\nKwota stała = cena wpisana wprost, nie podąża za Ceną klienta.\n\nAuto i własny mnożnik liczą tak samo (Cena klienta × mnożnik) — różni je tylko pochodzenie mnożnika.',
  discountType: 'Rabat — typ rabatu: — brak · % procent · zł kwota.',
  discountValue:
    'Rabat wart. — wartość rabatu.\nDla % = punkty procentowe (10 = 10%); dla zł = kwota odjęta od Netto.',
  priceGross:
    'Cena j.m. brutto = Cena j.m. netto × (1 + VAT).\nStawka VAT jest jedna na całą inwestycję — ta kolumna to przelicznik, nie osobna dana.',
  net: 'Netto = Pomiar × Cena − Rabat. Wartość pozycji przy aktywnym widoku cen.',
  gross: 'Brutto = Netto × (1 + VAT). Jedna stawka VAT na inwestycję, zdenormalizowana na wierszu.',
  remaining:
    'Pozostało netto = Netto − suma wartości etapów wpisanych w tym wierszu.\nIle z wartości pozycji nie zostało jeszcze rozliczone etapami. Pusty wiersz etapów = całe Netto zostaje.',
  remainingGross: 'Pozostało brutto = Pozostało netto × (1 + VAT).',
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
// Mnożnik and Cena j.m. both write the SAME pair of fields (overrideType + overrideValue) — the
// column you type into is what picks the type. That's why each is editable only in the modes where
// it carries the input: a mnożnik is meaningless under 'amount' (flat price), and a hand-typed price
// is meaningless under 'coeff'/auto (it's derived). The read-only side still renders its value so
// the row is legible in every mode.
function subcontractorCoeffColumn(
  view: 'w_tools' | 'own_tools',
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'priceCoeff',
    title: titleNode,
    minWidth: 90,
    keepFocus: true,
    component: ({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) => {
      const type = rowData[typeField] as SubcontractorOverrideTypeT | null
      if (type === 'amount') {
        return <span className="text-muted-foreground block w-full px-2 text-left">—</span>
      }
      // auto: the row carries no multiplier of its own — show the inherited one as a placeholder
      // (section coeff, else the investment default), italic to read as "not set here".
      const inherited = type == null
      return (
        <input
          className={`size-full bg-transparent px-2 text-left text-sm outline-none ${inherited ? 'text-muted-foreground italic' : ''}`}
          value={inherited ? '' : String(rowData[valueField] ?? '')}
          placeholder={
            inherited ? String(effectiveCoeff(rowData as unknown as ViewPricingT, view)) : ''
          }
          inputMode="decimal"
          onChange={(e) => {
            const raw = e.target.value.trim().replace(',', '.')
            if (raw === '') {
              setRowData({ ...rowData, [typeField]: null, [valueField]: 0 })
              return
            }
            const n = Number(raw)
            if (Number.isNaN(n)) return
            setRowData({ ...rowData, [typeField]: 'coeff', [valueField]: n })
          }}
        />
      )
    },
    copyValue: ({ rowData }) =>
      (rowData[typeField] as string | null) === 'amount'
        ? ''
        : String(effectiveCoeff(rowData as unknown as ViewPricingT, view)),
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}

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
      const price = viewPrice(rowData as unknown as ViewPricingT, view)
      if (type !== 'amount') {
        return (
          <span className="text-muted-foreground block w-full px-2 text-left">{fmt(price)}</span>
        )
      }
      return (
        <input
          className="size-full bg-transparent px-2 text-left text-sm outline-none"
          value={String(rowData[valueField] ?? '')}
          inputMode="decimal"
          onChange={(e) => {
            const raw = e.target.value.trim().replace(',', '.')
            if (raw === '') {
              setRowData({ ...rowData, [typeField]: null, [valueField]: 0 })
              return
            }
            const n = Number(raw)
            if (Number.isNaN(n)) return
            setRowData({ ...rowData, [typeField]: 'amount', [valueField]: n })
          }}
        />
      )
    },
    copyValue: ({ rowData }) => String(viewPrice(rowData as unknown as ViewPricingT, view)),
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}

// Switching to auto zeroes the override value. Switching auto→coeff seeds the inherited multiplier
// as the starting point — leaving it at 0 would silently collapse the row's price to zero.
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
          const seed =
            next === 'coeff' && !rowData[valueField]
              ? { [valueField]: effectiveCoeff(rowData as unknown as ViewPricingT, view) }
              : {}
          setRowData({
            ...rowData,
            [typeField]: next,
            ...(next === null ? { [valueField]: 0 } : seed),
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
    keyCol('sectionName', textColumn, {
      id: 'sectionName',
      title: title('sectionName', COLUMN_LABELS.sectionName, opts),
      minWidth: 140,
      // The section name is changed only from the panel — a per-row edit would change only this
      // row's copy (a denormalized field), not the section. Hence read-only.
      disabled: true,
    }),
    keyCol('description', textColumn, {
      id: 'description',
      title: title('description', COLUMN_LABELS.description, opts),
      minWidth: 240,
      grow: 2,
    }),
  ]

  const pricing: Column<KosztorysV2RowT>[] = [
    keyCol('plannedQty', floatColumnLeft, {
      id: 'plannedQty',
      title: title('plannedQty', COLUMN_LABELS.plannedQty, opts),
      minWidth: 90,
    }),
    keyCol('measuredQty', floatColumnLeft, {
      id: 'measuredQty',
      title: title('measuredQty', COLUMN_LABELS.measuredQty, opts),
      minWidth: 90,
    }),
    unitColumn(title('unit', COLUMN_LABELS.unit, opts)),
    ...priceCols,
    computedColumn(
      'priceGross',
      title('priceGross', COLUMN_LABELS.priceGross, opts),
      (r) => viewPrice(r as unknown as ViewPricingT, view) * (1 + r.vatRate),
    ),
    discountTypeColumn(title('discountType', COLUMN_LABELS.discountType, opts)),
    keyCol('discountValue', floatColumnLeft, {
      id: 'discountValue',
      title: title('discountValue', COLUMN_LABELS.discountValue, opts),
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
      title('net', COLUMN_LABELS.net, opts),
      (r) => rowNetForView(r as unknown as ViewPricingT, view),
      'font-medium',
    ),
    // Brutto = net × (1 + vatRate). VAT applies to post-discount net (rowNetForView already
    // subtracts the discount). One rate per investment, denormalized onto every row.
    computedColumn(
      'gross',
      title('gross', COLUMN_LABELS.gross, opts),
      (r) => rowNetForView(r as unknown as ViewPricingT, view) * (1 + r.vatRate),
    ),
    computedColumn('remaining', title('remaining', COLUMN_LABELS.remaining, opts), (r) =>
      rowRemainingForView(r as unknown as ViewPricingT, rowDoneNetForView(r, stages, view), view),
    ),
    computedColumn(
      'remainingGross',
      title('remainingGross', COLUMN_LABELS.remainingGross, opts),
      (r) =>
        rowRemainingForView(
          r as unknown as ViewPricingT,
          rowDoneNetForView(r, stages, view),
          view,
        ) *
        (1 + r.vatRate),
    ),
  ]

  // Column order mirrors the source sheet: opis → etapy (ilość) → przedmiar/pomiar/j.m. → cena.
  return [...identity, ...stageCols, ...pricing, ...computed]
}

// A stage column answers to the shared "Etapy" picker entry, not to its own id.
function toggleKey(columnId: string): string {
  return columnId.startsWith('stage_') ? STAGES_COLUMN_GROUP : columnId
}

export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  const base = assembleV2Columns(opts)
    .filter((c) => !opts.isHidden?.(toggleKey(c.id ?? '')))
    .map((c) => withResize(c, opts))
  return opts.onRemoveItem || opts.onReorderItem ? [actionColumn(opts), ...base] : base
}

// Picker entries for the columns this view actually has, in grid order. Stage columns collapse into
// the single "Etapy" entry — hence the dedupe.
export function buildV2ToggleItems(opts: BuildV2ColumnsOptsT): ColumnToggleItemT[] {
  const items: ColumnToggleItemT[] = []
  for (const col of assembleV2Columns(opts)) {
    const id = toggleKey(col.id ?? '')
    if (NON_HIDEABLE_COLUMNS.has(id) || items.some((i) => i.id === id)) continue
    items.push({ id, label: COLUMN_LABELS[id] ?? id, visible: !opts.isHidden?.(id) })
  }
  return items
}
