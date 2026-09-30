import type {
  KosztorysItemT,
  KosztorysStageT,
  KosztorysTreeT,
  StageProgressT,
} from '@/lib/kosztorys/types'
import { liveVersion } from '@/lib/kosztorys/history/snapshot-to-tree'
import type { HistoryVersionT } from '@/lib/kosztorys/history/types'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'

export const SECTION_ID = 10

export function item(
  id: number,
  description: string,
  plannedQty: number,
  clientPrice: number,
  overrides: Partial<KosztorysItemT> = {},
): KosztorysItemT {
  return { ...baseItem, id, description, plannedQty, clientPrice, ...overrides }
}

export function stage(id: number, ordinal: number, label: string | null = null): KosztorysStageT {
  return { id, ordinal, label, plane: null, split: null }
}

export function tree(
  items: KosztorysItemT[],
  stages: KosztorysStageT[] = [],
  progress: StageProgressT[] = [],
  overrides: Partial<KosztorysTreeT> = {},
): KosztorysTreeT {
  return makeTree({
    sections: [{ id: SECTION_ID, name: 'Łazienka', displayOrder: 0, color: null, items }],
    stages,
    progress,
    ...overrides,
  })
}

export const version = (...args: Parameters<typeof tree>): HistoryVersionT =>
  liveVersion(tree(...args))
