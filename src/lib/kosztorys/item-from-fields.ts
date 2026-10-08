import type { KosztorysItemT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// A katalog entry and a praca typed into „Nowa praca" are both spelled in the katalog's columns.
export type ItemFieldsT = Pick<
  WorkCatalogueItemT,
  | 'description'
  | 'descriptionTranslations'
  | 'unit'
  | 'clientPrice'
  | 'wToolsRate'
  | 'ownToolsRate'
  | 'wToolsRateCoeff'
  | 'ownToolsRateCoeff'
>

// Both sides model the stawka the same way — the same pair of kolumny, the same trzy źródła — so a
// katalog „auto" stays „auto" and derives from THIS investment's global współczynnik, a kwota stała
// arrives verbatim, and a mnożnik arrives as a mnożnik and re-prices itself off the cena j.m. it
// lands on. Copying at most one column per płaszczyzna is what keeps the pair legal: two set columns
// is the state `normalizeOverridePatch` exists to prevent.
const itemColumnsFromFields = (fields: ItemFieldsT) => ({
  description: fields.description,
  descriptionTranslations: fields.descriptionTranslations,
  unit: fields.unit,
  clientPrice: fields.clientPrice,
  wToolsOverrideValue: fields.wToolsRate,
  ownToolsOverrideValue: fields.ownToolsRate,
  wToolsOverrideCoeff: fields.wToolsRateCoeff,
  ownToolsOverrideCoeff: fields.ownToolsRateCoeff,
})

// A szablon row linked to a katalog entry shows the entry, not its own copy (EX-1017): the katalog is
// the one place a szablon praca's content lives. `null` = no entry to show — an unlinked row, a dead
// id, or a kosztorys row, which keeps its own values whatever it is linked to.
export const withCatalogueFields = <T extends KosztorysItemT>(
  item: T,
  fields: ItemFieldsT | null,
): T => (fields ? { ...item, ...itemColumnsFromFields(fields) } : item)

export const itemFromFields = (
  fields: ItemFieldsT,
  sectionId: number,
  displayOrder: number,
  catalogueItemId: number | null,
): KosztorysItemT => ({
  id: 0,
  sectionId,
  displayOrder,
  ...itemColumnsFromFields(fields),
  plannedQty: 0,
  currentPlannedQty: null,
  sheetMeasuredQty: null,
  discountType: null,
  discountValue: 0,
  note: null,
  catalogueItemId,
  aiPlannedQty: null,
  changeReason: null,
  reviewStatus: null,
})
