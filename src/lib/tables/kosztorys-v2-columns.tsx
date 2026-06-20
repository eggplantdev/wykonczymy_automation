'use client'

import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Column, type CellProps, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'
import { SortHeader } from '@/components/kosztorys/sort-header'
import { ResizableHeader } from '@/components/kosztorys/column-resize-handle'
import {
  effectiveVat,
  rowNetForView,
  rowRemainingForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { rowDoneNetForView, stageKey, type SortDirT } from '@/lib/kosztorys/v2-rows'
import type {
  DiscountTypeT,
  KosztorysSectionT,
  KosztorysStageT,
  KosztorysV2RowT,
  SubcontractorOverrideTypeT,
  ViewPricingT,
} from '@/types/kosztorys'

const fmt = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const DISCOUNT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'percent', label: '%' },
  { value: 'amount', label: 'zł' },
]

// Tryb liczenia ceny podwykonawcy (kolumna w widokach podwykonawcy). Etykiety opisowe —
// model jest nieoczywisty (patrz follow-up UX w change.md: wyjaśnienie nad tabelą).
const SUB_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'auto (z współczynnika)' },
  { value: 'coeff', label: '× mnożnik ceny klienta' },
  { value: 'amount', label: 'kwota zł' },
]

// Pola override per widok podwykonawcy.
const OVERRIDE_FIELDS: Record<
  'w_tools' | 'own_tools',
  { type: keyof KosztorysV2RowT; value: keyof KosztorysV2RowT }
> = {
  w_tools: { type: 'wToolsOverrideType', value: 'wToolsOverrideValue' },
  own_tools: { type: 'ownToolsOverrideType', value: 'ownToolsOverrideValue' },
}

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
  // Akcje na wierszu: usuwanie pozycji + odczyt liczby pozycji sekcji (do blokady
  // inwariantu „≥1 pozycja"). Oba czytają świeży stan z editora (ref) — bo dsg zamraża
  // `columns` na montażu, więc closure MUSI czytać aktualne dane, nie snapshot z mountu.
  onRemoveItem?: (row: KosztorysV2RowT) => void
  getSectionItemCount?: (sectionId: number) => number
  // Reorder pozycji w obrębie sekcji (▲/▼). Czyta świeży `rows` z editora (ref) — bo dsg
  // zamraża `columns` na montażu. Wyszarzony przy aktywnym sorcie kolumnowym (patrz `sort`).
  onReorderItem?: (row: KosztorysV2RowT, dir: 'up' | 'down') => void
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
    wToolsCoeff: r.sectionWToolsCoeff,
    ownToolsCoeff: r.sectionOwnToolsCoeff,
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

// Kolumna „Cena" w widoku podwykonawcy: pokazuje cenę wyprowadzoną (szaro, gdy override
// null) albo wpisaną wartość override. Wpisanie wartości w stan null tworzy override
// 'amount' (płaski); wyczyszczenie wraca do wyprowadzonej (null). Tryb coeff vs amount
// ustawia osobna kolumna „Tryb".
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

// Kolumna „Tryb" override ceny podwykonawcy: auto (null) / × (coeff) / zł (amount).
// Przejście na auto zeruje wartość override.
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

// Kolumna akcji: ▲▼ reorder pozycji w sekcji + kosz usuwający pozycję. Sztywne 64px,
// nie-resizable, nie-toggleable. Kosz nieaktywny gdy to ostatnia pozycja sekcji (inwariant
// „sekcja ma ≥1 pozycję"). Strzałki wyszarzone przy aktywnym sorcie kolumnowym — „w górę"
// względem listy posortowanej po cenie nie ma odwzorowania w display_order; najpierw zdejmij
// sort. (Brzeg bloku sekcji nie wyszarza strzałki — to no-op po stronie handlera, TODO MVP.)
function actionColumn(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT> {
  const onRemove = opts.onRemoveItem
  const onReorder = opts.onReorderItem
  const getCount = opts.getSectionItemCount
  const sortActive = opts.sort != null
  return {
    id: 'actions',
    title: '',
    basis: 64,
    grow: 0,
    shrink: 0,
    minWidth: 64,
    maxWidth: 64,
    disabled: true,
    component: ({ rowData }) => {
      const isLast = getCount ? getCount(rowData.sectionId) <= 1 : false
      return (
        <div className="flex size-full items-center justify-center gap-1">
          {onReorder && (
            <div className="flex flex-col leading-none">
              <button
                type="button"
                disabled={sortActive}
                title={sortActive ? 'Najpierw zdejmij sortowanie kolumną' : 'Przesuń w górę'}
                onClick={() => onReorder(rowData, 'up')}
                className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                disabled={sortActive}
                title={sortActive ? 'Najpierw zdejmij sortowanie kolumną' : 'Przesuń w dół'}
                onClick={() => onReorder(rowData, 'down')}
                className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={isLast}
            title={isLast ? 'Sekcja musi mieć co najmniej jedną pozycję' : 'Usuń pozycję'}
            onClick={() => onRemove?.(rowData)}
            className="text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    },
  }
}

export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  const { stages, view } = opts
  // Widok klient: prosta edytowalna cena. Widoki podwykonawcy: kolumna „Tryb" (override)
  // + „Cena" pokazująca wyprowadzoną/override. (Remount po `view` w edytorze — dsg zamraża
  // columns na montażu; patrz lekcja w lessons.md.)
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
      // Nazwę sekcji zmienia się wyłącznie z panelu — edycja per-wiersz zmieniałaby tylko
      // kopię tego wiersza (zdenormalizowane pole), nie sekcję. Stąd read-only.
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
      title: `E${st.ordinal}`,
      minWidth: 64,
    }),
  )

  const computed: Column<KosztorysV2RowT>[] = [
    computedColumn(
      'net',
      title('net', 'Netto', opts),
      (r) => rowNetForView(r as unknown as ViewPricingT, view),
      'font-medium',
    ),
    computedColumn('gross', title('gross', 'Brutto', opts), (r) => {
      const item = r as unknown as ViewPricingT
      return rowNetForView(item, view) * (1 + effectiveVat(item, asSection(r)))
    }),
    computedColumn('remaining', title('remaining', 'Pozostało', opts), (r) =>
      rowRemainingForView(r as unknown as ViewPricingT, rowDoneNetForView(r, stages, view), view),
    ),
  ]

  const base = [...left, ...stageCols, ...computed].map((c) => withResize(c, opts))
  return opts.onRemoveItem || opts.onReorderItem ? [actionColumn(opts), ...base] : base
}
