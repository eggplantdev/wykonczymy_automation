'use client'

import { Column, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'
import { effectiveVat, rowNetForView, type PriceViewT } from '@/lib/kosztorys/calc'
import { stageKey } from '@/lib/kosztorys/v2-rows'
import type {
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
  title: string,
  compute: (r: KosztorysV2RowT) => number,
): Column<KosztorysV2RowT> {
  return {
    id,
    title,
    disabled: true,
    component: ({ rowData }) => (
      <span className="block w-full pr-2 text-right">{fmt(compute(rowData))}</span>
    ),
  }
}

export function buildV2Columns(
  stages: KosztorysStageT[],
  view: PriceViewT,
): Column<KosztorysV2RowT>[] {
  const left: Column<KosztorysV2RowT>[] = [
    keyCol('sectionName', textColumn, { title: 'Sekcja', minWidth: 140 }),
    keyCol('description', textColumn, { title: 'Opis', minWidth: 240, grow: 2 }),
    keyCol('unit', textColumn, { title: 'J.m.', minWidth: 64 }),
    keyCol('plannedQty', floatColumn, { title: 'Przedmiar', minWidth: 90 }),
    keyCol('measuredQty', floatColumn, { title: 'Pomiar', minWidth: 90 }),
    // Aktywna cena zależna od widoku (ten sam wiersz, inna kolumna ceny).
    keyCol(PRICE_FIELD[view], floatColumn, { title: 'Cena', minWidth: 90 }),
    keyCol('discountValue', floatColumn, { title: 'Rabat', minWidth: 80 }),
  ]

  const stageCols: Column<KosztorysV2RowT>[] = stages.map((st) =>
    keyCol(stageKey(st.id), floatColumn, { title: `E${st.ordinal}`, minWidth: 64 }),
  )

  const computed: Column<KosztorysV2RowT>[] = [
    computedColumn('net', 'Netto', (r) => rowNetForView(r as unknown as KosztorysItemT, view)),
    computedColumn('gross', 'Brutto', (r) => {
      const item = r as unknown as KosztorysItemT
      return rowNetForView(item, view) * (1 + effectiveVat(item, asSection(r)))
    }),
  ]

  return [...left, ...stageCols, ...computed]
}
