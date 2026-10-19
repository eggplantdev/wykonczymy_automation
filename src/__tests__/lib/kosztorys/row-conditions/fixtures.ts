import { planePriceKeysFor } from '@/lib/kosztorys/plane-price-keys'
import { stageKey } from '@/lib/kosztorys/stage-keys'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import { baseItem, makeStage } from '@/__tests__/helpers/kosztorys-tree'

const STAGES: KosztorysStageT[] = [
  makeStage({ id: 1, plane: null }),
  makeStage({ id: 2, ordinal: 2, split: oneWorkerSplit(5) }),
]
export const CTX = {
  stages: STAGES,
  hasSettledMaterial: false,
  divergentPriceRowIds: new Set<number>(),
}

export const priceCells = (...planes: ('w_tools' | 'own_tools')[]) => [
  'price',
  ...planes.flatMap((plane) => planePriceKeysFor(plane)),
]

export function row(overrides: Partial<KosztorysV2RowT> = {}): KosztorysV2RowT {
  return {
    ...baseItem,
    id: 1,
    description: 'Posadzki z mikrocementu',
    plannedQty: 95,
    clientPrice: 100,
    wToolsOverrideValue: null,
    ownToolsOverrideValue: null,
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
