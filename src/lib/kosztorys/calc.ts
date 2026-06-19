import type { CostVariantT, KosztorysItemT, KosztorysSectionT } from '@/types/kosztorys'

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

function variantPrice(item: KosztorysItemT, section: KosztorysSectionT): number {
  return effectiveCostVariant(item, section) === 'own_tools'
    ? item.subcontractorOwnToolsPrice
    : item.subcontractorWToolsPrice
}

/** Plan kosztu podwykonawcy wg wariantu kosztu pozycji (pomiar × cena wariantu − rabat). */
export function rowSubcontractorNet(item: KosztorysItemT, section: KosztorysSectionT): number {
  return applyDiscount(item.measuredQty * variantPrice(item, section), item)
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
