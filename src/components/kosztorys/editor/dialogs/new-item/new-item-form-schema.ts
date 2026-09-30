import { z } from 'zod'
import {
  refineRatePlanes,
  workCatalogueItemBaseSchema,
} from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { stripSectionOrdinal } from '@/lib/kosztorys/work-catalogue/section-category'

// The katalog form's fields plus the one decision this form adds: whether the praca also goes to the
// cennik. Kategoria stays in the values while the checkbox is off, so ticking it back on finds the
// sekcja name still there.
export const newItemFormSchema = workCatalogueItemBaseSchema
  .extend({ addToCatalogue: z.boolean() })
  .superRefine(refineRatePlanes)

export type NewItemFormValuesT = z.infer<typeof newItemFormSchema>

export const newItemDefaults = (sectionName: string): NewItemFormValuesT => ({
  description: '',
  category: stripSectionOrdinal(sectionName),
  unit: '',
  clientPrice: '',
  wToolsSource: 'auto',
  wToolsRate: '',
  wToolsCoeff: '',
  ownToolsSource: 'auto',
  ownToolsRate: '',
  ownToolsCoeff: '',
  addToCatalogue: false,
})
