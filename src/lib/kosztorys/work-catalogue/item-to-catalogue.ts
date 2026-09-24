import type { ViewPricingT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { impliedCatalogueRate } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { stripSectionOrdinal } from '@/lib/kosztorys/work-catalogue/section-category'
import type { CatalogueSeedItemT, CatalogueSourceItemT } from '@/lib/kosztorys/work-catalogue/types'

// Pricing reads a whole row; the fields it never touches on this path (quantities, rabat, notatka)
// are supplied at their neutral values so the two planes can be asked the same question they answer
// in the grid.
const asPricing = (source: CatalogueSourceItemT): ViewPricingT => ({
  id: 0,
  sectionId: 0,
  displayOrder: 0,
  description: source.description,
  unit: source.unit,
  plannedQty: 0,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  clientPrice: source.clientPrice,
  wToolsOverrideValue: source.wToolsOverrideValue,
  ownToolsOverrideValue: source.ownToolsOverrideValue,
  wToolsOverrideCoeff: source.wToolsOverrideCoeff,
  ownToolsOverrideCoeff: source.ownToolsOverrideCoeff,
  note: null,
  globalDiscountActive: false,
  // Unreachable: only a plane with its own nadpisanie is read here, and neither a kwota stała nor a
  // własny mnożnik consults the global współczynnik.
  globalWToolsCoeff: 0,
  globalOwnToolsCoeff: 0,
})

/**
 * The cennik row a praca from the rozpiska implies. Each stawka is decided SEPARATELY by
 * `impliedCatalogueRate`. Cena is the pre-rabat `clientPrice`: a rabat is a concession on one offer,
 * never part of the cennik.
 */
export function toCatalogueCandidate(source: CatalogueSourceItemT): CatalogueSeedItemT {
  const pricing = asPricing(source)
  const description = source.description.trim()
  const unit = source.unit.trim()
  const category = stripSectionOrdinal(source.sectionName)
  const wTools = impliedCatalogueRate(pricing, 'w_tools')
  const ownTools = impliedCatalogueRate(pricing, 'own_tools')
  return {
    description,
    category: category || null,
    unit,
    clientPrice: source.clientPrice,
    wToolsRate: wTools.rate,
    wToolsRateCoeff: wTools.coeff,
    ownToolsRate: ownTools.rate,
    ownToolsRateCoeff: ownTools.coeff,
    matchKey: catalogueKey(description, unit),
  }
}
