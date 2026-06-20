import type {
  CostVariantT,
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysV2RowT,
  SectionSubtotalT,
  ViewPricingT,
} from '@/types/kosztorys'

// Jedyne źródło formuł rozpiski. Czyste funkcje — zapisujemy tylko inputy, wszystko
// poniżej liczymy na żywo. Wartość liczona z measuredQty (pomiar), nie plannedQty.
//
// Rabat: discountValue dla 'percent' = punkty procentowe (10 => 10%), dla 'amount'
// = kwota w zł odjęta od wartości netto.

export function effectiveVat(item: KosztorysItemT, section: KosztorysSectionT): number {
  return item.vatRate ?? section.vatRate
}

export function effectiveCostVariant(
  item: KosztorysItemT,
  section: KosztorysSectionT,
): CostVariantT {
  return item.costVariant ?? section.defaultCostVariant
}

function applyDiscount(gross: number, item: KosztorysItemT): number {
  if (item.discountType === 'percent') return gross * (1 - (item.discountValue || 0) / 100)
  if (item.discountType === 'amount') return gross - (item.discountValue || 0)
  return gross
}

/** Wartość netto wiersza wg ceny klienta (pomiar × cena − rabat). */
export function rowNet(item: KosztorysItemT): number {
  return applyDiscount(item.measuredQty * item.clientPrice, item)
}

export function rowGross(item: KosztorysItemT, section: KosztorysSectionT): number {
  return rowNet(item) * (1 + effectiveVat(item, section))
}

/** Wartość pojedynczego etapu pozycji (ilość wykonana × cena klienta − rabat). */
export function stageValue(item: KosztorysItemT, qtyDoneInStage: number): number {
  return applyDiscount(qtyDoneInStage * item.clientPrice, item)
}

/** Pozostało do wykonania = netto wiersza − Σ wartości wykonanych etapów. */
export function rowRemaining(item: KosztorysItemT, doneNetTotal: number): number {
  return rowNet(item) - doneNetTotal
}

// --- Widoki cenowe (jeden zbiór → trzy widoki: klient / podwykonawca z/bez narzędzi) ---
export type PriceViewT = 'client' | 'w_tools' | 'own_tools'

/** Efektywny współczynnik narzutu wg widoku: sekcja nadpisuje globalny (z inwestycji). */
export function effectiveCoeff(row: ViewPricingT, view: 'w_tools' | 'own_tools'): number {
  if (view === 'w_tools') return row.sectionWToolsCoeff ?? row.globalWToolsCoeff
  return row.sectionOwnToolsCoeff ?? row.globalOwnToolsCoeff
}

/** Cena podwykonawcy wg widoku: null→wyprowadzona (klient×coeff), coeff→klient×%, amount→płaska. */
export function subcontractorPrice(row: ViewPricingT, view: 'w_tools' | 'own_tools'): number {
  const type = view === 'w_tools' ? row.wToolsOverrideType : row.ownToolsOverrideType
  const value = view === 'w_tools' ? row.wToolsOverrideValue : row.ownToolsOverrideValue
  if (type === 'amount') return value
  if (type === 'coeff') return row.clientPrice * value
  return row.clientPrice * effectiveCoeff(row, view)
}

export function viewPrice(row: ViewPricingT, view: PriceViewT): number {
  if (view === 'w_tools' || view === 'own_tools') return subcontractorPrice(row, view)
  return row.clientPrice
}

/** Netto wiersza wg ceny wybranego widoku (pomiar × cena widoku − rabat). */
export function rowNetForView(row: ViewPricingT, view: PriceViewT): number {
  return applyDiscount(row.measuredQty * viewPrice(row, view), row)
}

/** Wartość pojedynczego etapu wg ceny widoku (ilość wykonana × cena widoku − rabat). */
export function stageValueForView(
  row: ViewPricingT,
  qtyDoneInStage: number,
  view: PriceViewT,
): number {
  return applyDiscount(qtyDoneInStage * viewPrice(row, view), row)
}

/** Pozostało wg widoku = netto widoku − Σ wartości wykonanych etapów wg widoku. */
export function rowRemainingForView(
  row: ViewPricingT,
  doneNetTotal: number,
  view: PriceViewT,
): number {
  return rowNetForView(row, view) - doneNetTotal
}

/**
 * Subtotale netto per sekcja wg aktywnego widoku cenowego. Liczone po pełnym
 * zbiorze (ignoruje filtr/sort). Kolejność = pierwszego wystąpienia sekcji w
 * `rows` (treeToRows daje już porządek sekcja→displayOrder).
 */
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  view: PriceViewT,
): SectionSubtotalT[] {
  const bySection = new Map<number, SectionSubtotalT>()
  for (const row of rows) {
    let acc = bySection.get(row.sectionId)
    if (!acc) {
      acc = {
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        net: 0,
        share: 0,
        itemCount: 0,
      }
      bySection.set(row.sectionId, acc)
    }
    acc.net += rowNetForView(row, view)
    acc.itemCount += 1
  }
  const result = [...bySection.values()]
  const grandNet = result.reduce((sum, s) => sum + s.net, 0)
  if (grandNet > 0) for (const s of result) s.share = s.net / grandNet
  return result
}
