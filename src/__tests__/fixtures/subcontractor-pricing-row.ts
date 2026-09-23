import type { ViewPricingT } from '@/lib/kosztorys/types'

/**
 * 100 zł for the client against a 0,65 mnożnik: „auto" derives 65, which is exactly where the
 * ceiling sits. Shared by the cell specs, which all reason about that one arithmetic.
 */
export function pricingRow(overrides: Partial<ViewPricingT> = {}): ViewPricingT {
  return {
    id: 1,
    sectionId: 10,
    displayOrder: 0,
    description: 'Malowanie',
    unit: 'm2',
    plannedQty: 10,
    sheetMeasuredQty: null,
    discountType: null,
    discountValue: 0,
    clientPrice: 100,
    wToolsOverrideValue: null,
    ownToolsOverrideValue: null,
    wToolsOverrideCoeff: null,
    ownToolsOverrideCoeff: null,
    note: null,
    globalDiscountActive: false,
    globalWToolsCoeff: 0.65,
    globalOwnToolsCoeff: 0.55,
    ...overrides,
  }
}
