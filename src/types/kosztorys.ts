// Płaskie typy rozpiski robocizny (POC). Relacje zredukowane do *_id liczb —
// query pobiera z głębokością 0. costVariant/vatRate = null oznacza "dziedzicz z sekcji".

export type DiscountTypeT = 'percent' | 'amount'
export type CostVariantT = 'w_tools' | 'own_tools'

export type KosztorysSectionT = {
  id: number
  name: string
  displayOrder: number
  vatRate: number
  defaultCostVariant: CostVariantT
}

export type KosztorysItemT = {
  id: number
  sectionId: number
  displayOrder: number
  description: string | null
  unit: string | null
  plannedQty: number
  measuredQty: number
  discountType: DiscountTypeT | null
  discountValue: number
  clientPrice: number
  subcontractorWToolsPrice: number
  subcontractorOwnToolsPrice: number
  costVariant: CostVariantT | null
  vatRate: number | null
  hiddenInExport: boolean
  note: string | null
}

export type KosztorysStageT = {
  id: number
  ordinal: number
  label: string | null
}

export type StageProgressT = {
  itemId: number
  stageId: number
  qtyDone: number
}

export type KosztorysTreeT = {
  sections: (KosztorysSectionT & { items: KosztorysItemT[] })[]
  stages: KosztorysStageT[]
  progress: StageProgressT[]
}

// --- Wariant v2 (react-datasheet-grid): płaski wiersz z etapami spłaszczonymi
// do kluczy stage_<stageId>, żeby keyColumn mapował 1:1. ---
export type KosztorysV2RowBaseT = KosztorysItemT & {
  sectionName: string
  sectionVatRate: number
  sectionDefaultCostVariant: CostVariantT
}

export type KosztorysV2RowT = KosztorysV2RowBaseT & {
  [stageKey: `stage_${number}`]: number
}

export type SectionSubtotalT = {
  sectionId: number
  sectionName: string
  net: number
  share: number // 0..1, udział w sumie netto wszystkich sekcji
  itemCount: number
}
