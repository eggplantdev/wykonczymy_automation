import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

const STAGES: KosztorysStageT[] = [
  { id: 1, ordinal: 1, label: null, plane: null, workerId: null },
  { id: 2, ordinal: 2, label: null, plane: 'w_tools', workerId: 5 },
]
export const CTX = {
  stages: STAGES,
  hasSettledMaterial: false,
  divergentPriceRowIds: new Set<number>(),
}

// The client's cena j.m. plus one crew's rate pair — what a price problem on that plane is repaired
// in. Both planes' columns exist in every view now, so a reveal that named both would answer a
// question about one crew with the other crew's numbers beside it.
export const priceCells = (...planes: ('w_tools' | 'own_tools')[]) => [
  'price',
  ...planes.flatMap((plane) =>
    (['priceMode', 'price'] as const).map((base) => planePriceKey(base, plane)),
  ),
]

export function row(overrides: Partial<KosztorysV2RowT> = {}): KosztorysV2RowT {
  return {
    id: 1,
    sectionId: 10,
    displayOrder: 0,
    description: 'Posadzki z mikrocementu',
    unit: 'm2',
    plannedQty: 95,
    sheetMeasuredQty: null,
    discountType: null,
    discountValue: 0,
    clientPrice: 100,
    wToolsOverrideValue: null,
    ownToolsOverrideValue: null,
    note: null,
    sectionName: 'Podłogi',
    sectionColor: null,
    vatRate: 0.08,
    globalDiscountActive: false,
    globalWToolsCoeff: 0.65,
    globalOwnToolsCoeff: 0.5,
    [stageKey(1)]: 0,
    [stageKey(2)]: 0,
    ...overrides,
  } as KosztorysV2RowT
}
