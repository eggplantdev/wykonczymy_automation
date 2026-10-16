import type { KosztorysItemT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { NO_AI_DRAFT } from '@/lib/kosztorys/constants'

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
  ...NO_AI_DRAFT,
  changeReason: null,
  reviewStatus: null,
})
