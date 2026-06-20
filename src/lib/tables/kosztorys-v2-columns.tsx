'use client'

import type { ReactNode } from 'react'
import { Column, type CellProps, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'
import { SortHeader } from '@/components/kosztorys/sort-header'
import { ResizableHeader } from '@/components/kosztorys/column-resize-handle'
import {
  effectiveVat,
  rowNetForView,
  rowRemainingForView,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { rowDoneNetForView, stageKey, type SortDirT } from '@/lib/kosztorys/v2-rows'
import type {
  DiscountTypeT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  KosztorysV2RowT,
} from '@/types/kosztorys'

const fmt = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Pole ceny renderowane jako aktywna kolumna „Cena" zależnie od widoku.
const PRICE_FIELD: Record<PriceViewT, keyof KosztorysV2RowT> = {
  client: 'clientPrice',
  w_tools: 'subcontractorWToolsPrice',
  own_tools: 'subcontractorOwnToolsPrice',
}

const DISCOUNT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'percent', label: '%' },
  { value: 'amount', label: 'zł' },
]

export type V2SortStateT = { field: string; dir: SortDirT } | null

export type BuildV2ColumnsOptsT = {
  stages: KosztorysStageT[]
  view: PriceViewT
  sort?: V2SortStateT
  onToggleSort?: (field: string) => void
  // Resize: szerokości przypiętych kolumn (id→px) + callbacki dragu. Gdy podane,
  // każda kolumna dostaje uchwyt; przypięte zyskują basis/grow:0 (reszta zostaje na flex).
  widths?: Record<string, number>
  onGuide?: (x: number | null) => void
  onCommitColumn?: (id: string, width: number) => void
}

// keyColumn wymaga column: Column<Row[K]>. floatColumn/textColumn są nullowalne
// (Column<number|null> / <string|null>), a pola pozycji są non-null. Cell-typ jest
// niezmienniczy (rowData kowariantne + setRowData kontrawariantne), więc żaden konkretny
// typ poza dokładnym dopasowaniem nie przejdzie — jedyny bezpieczny most to `any` na
// granicy biblioteki. Komórki są nullosafe w runtime; zwracamy gotową Column<KosztorysV2RowT>.
function keyCol(
  key: keyof KosztorysV2RowT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Partial<Column<any>>,
  rest: Partial<Column<KosztorysV2RowT>>,
): Column<KosztorysV2RowT> {
  return { ...(keyColumn(key, column) as Column<KosztorysV2RowT>), ...rest }
}

// Tytuł kolumny jako klikalny nagłówek sortujący (gdy onToggleSort podany).
function title(field: string, label: string, opts: BuildV2ColumnsOptsT): ReactNode {
  if (!opts.onToggleSort) return label
  const active = opts.sort?.field === field ? opts.sort.dir : null
  return <SortHeader label={label} active={active} onToggle={() => opts.onToggleSort?.(field)} />
}

// Rekonstrukcja inputów dla calc.ts z płaskiego wiersza.
function asSection(r: KosztorysV2RowT): KosztorysSectionT {
  return {
    id: r.sectionId,
    name: r.sectionName,
    displayOrder: 0,
    vatRate: r.sectionVatRate,
    defaultCostVariant: r.sectionDefaultCostVariant,
  }
}

// Kolumna liczona, read-only: własny component renderujący wartość z calc.
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

// Komórka select typu rabatu (parytet z v1: —/%/zł). setRowData zasila diff → autosave.
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

// Jedyne źródło etykiet kolumn dla przełącznika widoczności (id ↔ etykieta).
// Etapy dynamiczne; reszta stała. Trzyma parytet z id ustawionymi w buildV2Columns.
export function v2ToggleableColumns(stages: KosztorysStageT[]): { id: string; label: string }[] {
  return [
    { id: 'sectionName', label: 'Sekcja' },
    { id: 'description', label: 'Opis' },
    { id: 'unit', label: 'J.m.' },
    { id: 'plannedQty', label: 'Przedmiar' },
    { id: 'measuredQty', label: 'Pomiar' },
    { id: 'price', label: 'Cena' },
    { id: 'discountType', label: 'Rabat' },
    { id: 'discountValue', label: 'Rabat wart.' },
    ...stages.map((st) => ({ id: stageKey(st.id), label: `Etap ${st.ordinal}` })),
    { id: 'net', label: 'Netto' },
    { id: 'gross', label: 'Brutto' },
    { id: 'remaining', label: 'Pozostało' },
  ]
}

// Nakłada na kolumnę przypiętą szerokość (basis/grow:0) i owija jej title w uchwyt resize.
// Bez callbacków dragu (onResizeColumn) zwraca kolumnę bez zmian — resize wyłączony.
function withResize(
  col: Column<KosztorysV2RowT>,
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT> {
  if (!opts.onGuide || !opts.onCommitColumn || !col.id) return col
  const min = col.minWidth ?? 100
  const pinned = opts.widths?.[col.id]
  // Przypięcie = sztywna szerokość niezależna od algorytmu flex dsg: min=max=basis=W,
  // grow/shrink 0. (Samo `basis` dsg ignorował przy overflow — siadał na minWidth.)
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

export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  const { stages, view } = opts
  const left: Column<KosztorysV2RowT>[] = [
    keyCol('sectionName', textColumn, {
      id: 'sectionName',
      title: title('sectionName', 'Sekcja', opts),
      minWidth: 140,
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
    // Aktywna cena zależna od widoku (ten sam wiersz, inna kolumna ceny). id stałe = 'price'.
    keyCol(PRICE_FIELD[view], floatColumn, {
      id: 'price',
      title: title('price', 'Cena', opts),
      minWidth: 90,
    }),
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
      title: `E${st.ordinal}`,
      minWidth: 64,
    }),
  )

  const computed: Column<KosztorysV2RowT>[] = [
    computedColumn(
      'net',
      title('net', 'Netto', opts),
      (r) => rowNetForView(r as unknown as KosztorysItemT, view),
      'font-medium',
    ),
    computedColumn('gross', title('gross', 'Brutto', opts), (r) => {
      const item = r as unknown as KosztorysItemT
      return rowNetForView(item, view) * (1 + effectiveVat(item, asSection(r)))
    }),
    computedColumn('remaining', title('remaining', 'Pozostało', opts), (r) =>
      rowRemainingForView(r as unknown as KosztorysItemT, rowDoneNetForView(r, stages, view), view),
    ),
  ]

  return [...left, ...stageCols, ...computed].map((c) => withResize(c, opts))
}
