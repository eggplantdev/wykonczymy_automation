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
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  note: null,
  globalDiscountActive: false,
  // Unreachable: only a plane with its own nadpisanie is priced here, and a kwota stała consults no
  // global współczynnik.
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
  return {
    description,
    category: category || null,
    unit,
    clientPrice: source.clientPrice,
    wToolsRate: impliedCatalogueRate(pricing, 'w_tools'),
    ownToolsRate: impliedCatalogueRate(pricing, 'own_tools'),
    matchKey: catalogueKey(description, unit),
  }
}
