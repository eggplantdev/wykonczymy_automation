// Płaskie typy rozpiski robocizny. Relacje zredukowane do *_id liczb —
// query pobiera z głębokością 0. costVariant = null oznacza "dziedzicz z sekcji".
// VAT to jedna stawka na inwestycję (KosztorysTreeT.vatRate), nie per sekcja/pozycja;
// w S-01 niesiona jako 0 (VAT wchodzi w S-12).

export type DiscountTypeT = 'percent' | 'amount'
export type CostVariantT = 'w_tools' | 'own_tools'
// Override ceny podwykonawcy per pozycja: 'coeff' = klient × wartość (podąża za ceną
// klienta), 'amount' = płaska kwota (zamrożona), null = wyprowadź z efektywnego współczynnika.
export type SubcontractorOverrideTypeT = 'coeff' | 'amount'

export type KosztorysSectionT = {
  id: number
  name: string
  displayOrder: number
  defaultCostVariant: CostVariantT
  // null = dziedziczy globalny współczynnik z inwestycji.
  wToolsCoeff: number | null
  ownToolsCoeff: number | null
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
  wToolsOverrideType: SubcontractorOverrideTypeT | null
  wToolsOverrideValue: number
  ownToolsOverrideType: SubcontractorOverrideTypeT | null
  ownToolsOverrideValue: number
  costVariant: CostVariantT | null
  hiddenInExport: boolean
  note: string | null
}

// Patch autosave pozycji = podzbiór pól edytowalnych w siatce (bez id/sectionId/displayOrder).
// Jedno źródło prawdy: importowany zarówno przez czysty core (v2-rows diffRow/RowDiffT) jak
// i przez akcję serwerową updateItemFieldAction (walidacja zod dopina się do tego kształtu).
export type ItemPatchT = Partial<
  Pick<
    KosztorysItemT,
    | 'description'
    | 'unit'
    | 'plannedQty'
    | 'measuredQty'
    | 'discountType'
    | 'discountValue'
    | 'clientPrice'
    | 'wToolsOverrideType'
    | 'wToolsOverrideValue'
    | 'ownToolsOverrideType'
    | 'ownToolsOverrideValue'
    | 'costVariant'
    | 'hiddenInExport'
    | 'note'
  >
>

// Globalne (na inwestycję) współczynniki narzutu podwykonawcy; niesione przez drzewo.
export type KosztorysGlobalCoeffsT = { wTools: number; ownTools: number }

// Minimalny kształt do derivacji ceny widoku — KosztorysV2RowT go spełnia
// (KosztorysItemT + zdenormalizowane współczynniki sekcji i globalne).
export type ViewPricingT = KosztorysItemT & {
  sectionWToolsCoeff: number | null
  sectionOwnToolsCoeff: number | null
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
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
  globalCoeffs: KosztorysGlobalCoeffsT
  // Jedna stawka VAT na inwestycję — niesiona drzewem (jak globalCoeffs), zdenormalizowana na wiersz.
  vatRate: number
}

// --- Wariant v2 (react-datasheet-grid): płaski wiersz z etapami spłaszczonymi
// do kluczy stage_<stageId>, żeby keyColumn mapował 1:1. ---
export type KosztorysV2RowBaseT = KosztorysItemT & {
  sectionName: string
  // Zdenormalizowana stawka VAT inwestycji (jedna na cały kosztorys) — brutto = netto × (1 + vatRate).
  vatRate: number
  sectionDefaultCostVariant: CostVariantT
  // Zdenormalizowane współczynniki do derivacji ceny podwykonawcy na wierszu (ViewPricingT).
  sectionWToolsCoeff: number | null
  sectionOwnToolsCoeff: number | null
  globalWToolsCoeff: number
  globalOwnToolsCoeff: number
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
