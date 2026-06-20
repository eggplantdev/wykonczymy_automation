import { escapeCsv } from '@/lib/export/csv-cell'
import type { KosztorysExportColumnT } from '@/lib/export/kosztorys-export-columns'
import { effectiveVat, rowNetForView, type PriceViewT } from '@/lib/kosztorys/calc'
import type {
  KosztorysSectionT,
  KosztorysV2RowT,
  SectionSubtotalT,
  ViewPricingT,
} from '@/types/kosztorys'

const fmtPLN = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function headerLine(columns: KosztorysExportColumnT[]): string {
  return columns.map((c) => escapeCsv(c.label)).join(',')
}

function rowLine(
  row: KosztorysV2RowT,
  columns: KosztorysExportColumnT[],
  view: PriceViewT,
): string {
  return columns.map((c) => escapeCsv(c.getValue(row, view))).join(',')
}

function sectionOf(r: KosztorysV2RowT): KosztorysSectionT {
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

/** Płaski: nagłówek + jeden wiersz na pozycję; sekcja jako kolumna. */
export function buildKosztorysCsvFlat(
  rows: KosztorysV2RowT[],
  columns: KosztorysExportColumnT[],
  view: PriceViewT,
): string {
  return [headerLine(columns), ...rows.map((r) => rowLine(r, columns, view))].join('\n')
}

/**
 * Grupowany: per sekcja → nagłówek sekcji, pozycje, subtotal sekcji; na końcu
 * suma netto/VAT/brutto. Wiersze nie-pozycyjne wyrównane do liczby kolumn, a
 * wartość trafia pod kolumnę „Netto" (lub ostatnią, gdy „Netto" ukryte).
 */
export function buildKosztorysCsvGrouped(
  rows: KosztorysV2RowT[],
  columns: KosztorysExportColumnT[],
  view: PriceViewT,
  subtotals: SectionSubtotalT[],
): string {
  const width = columns.length
  const netIdx = columns.findIndex((c) => c.id === 'net')
  const valueIdx = netIdx >= 0 ? netIdx : Math.max(1, width - 1)

  const pad = (cells: string[]): string =>
    Array.from({ length: width }, (_, i) => escapeCsv(cells[i] ?? '')).join(',')

  const put = (label: string, value: string): string => {
    const cells: string[] = []
    cells[0] = label
    if (valueIdx !== 0) cells[valueIdx] = value
    return pad(cells)
  }

  const lines: string[] = [headerLine(columns)]
  let grossTotal = 0
  let netTotal = 0
  for (const sub of subtotals) {
    const secRows = rows.filter((r) => r.sectionId === sub.sectionId)
    if (secRows.length === 0) continue // sekcja odfiltrowana z widoku — pomiń
    lines.push(pad([sub.sectionName]))
    for (const r of secRows) lines.push(rowLine(r, columns, view))
    lines.push(put(`Subtotal ${sub.sectionName}`, fmtPLN(sub.net)))
    netTotal += sub.net
    for (const r of secRows) {
      const item = r as unknown as ViewPricingT
      grossTotal += rowNetForView(item, view) * (1 + effectiveVat(item, sectionOf(r)))
    }
  }
  lines.push(pad([]))
  lines.push(put('Suma netto', fmtPLN(netTotal)))
  lines.push(put('Suma VAT', fmtPLN(grossTotal - netTotal)))
  lines.push(put('Suma brutto', fmtPLN(grossTotal)))
  return lines.join('\n')
}
