import type { KosztorysItemT, KosztorysStageT, KosztorysTreeT } from '@/lib/kosztorys/types'

// `sections` is required rather than merely Partial: an omitted one would leave
// a spec silently asserting against an empty tree instead of failing to compile.
export function makeTree(
  scenario: Pick<KosztorysTreeT, 'sections'> & Partial<KosztorysTreeT>,
): KosztorysTreeT {
  return {
    stages: [],
    progress: [],
    globalCoeffs: { wTools: 0.65, ownTools: 0.55 },
    vatRate: 0.23,
    settlementMode: 'NET',
    materialsNetRate: null,
    globalDiscount: { type: null, value: 0 },
    revision: '2026-01-01T00:00:00.000Z',
    ...scenario,
  }
}

export function makeStage(overrides: Partial<KosztorysStageT> = {}): KosztorysStageT {
  return {
    id: 100,
    ordinal: 1,
    label: null,
    plane: 'w_tools',
    split: null,
    completed: false,
    ...overrides,
  }
}

export const baseItem: Omit<KosztorysItemT, 'id' | 'description' | 'plannedQty' | 'clientPrice'> = {
  sectionId: 10,
  displayOrder: 0,
  descriptionTranslations: {},
  unit: 'm2',
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  wToolsOverrideValue: 12,
  ownToolsOverrideValue: 10,
  wToolsOverrideCoeff: null,
  ownToolsOverrideCoeff: null,
  note: null,
  catalogueItemId: null,
  currentPlannedQty: null,
  aiPlannedQty: null,
  aiMissingData: null,
  aiAssumptions: null,
  aiNewInformation: null,
  aiRecheck: false,
  changeReason: null,
  reviewStatus: null,
}
