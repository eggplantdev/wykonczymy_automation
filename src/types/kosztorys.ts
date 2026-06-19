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

// Spłaszczony wiersz dla siatki (TanStack DataTable): pozycja + denormalizowane
// pola sekcji (do liczenia/sortowania/filtrowania) + ilości etapów per stageId.
export type KosztorysEditorRowT = KosztorysItemT & {
  sectionName: string
  sectionOrder: number
  sectionVatRate: number
  sectionDefaultCostVariant: CostVariantT
  stageQty: Record<number, number>
}
