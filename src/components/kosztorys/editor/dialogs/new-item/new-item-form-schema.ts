import { z } from 'zod'
import {
  EMPTY_CATALOGUE_ITEM_VALUES,
  refineRatePlanes,
  workCatalogueItemBaseSchema,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { stripSectionOrdinal } from '@/lib/kosztorys/work-catalogue/section-category'

// Kategoria stays in the values while the checkbox is off, so ticking it back on finds the sekcja
// name still there.
export const newItemFormSchema = workCatalogueItemBaseSchema
  .extend({ addToCatalogue: z.boolean() })
  .superRefine(refineRatePlanes)

export type NewItemFormValuesT = z.infer<typeof newItemFormSchema>

export const newItemDefaults = (sectionName: string): NewItemFormValuesT => ({
  ...EMPTY_CATALOGUE_ITEM_VALUES,
  category: stripSectionOrdinal(sectionName),
  addToCatalogue: true,
})
