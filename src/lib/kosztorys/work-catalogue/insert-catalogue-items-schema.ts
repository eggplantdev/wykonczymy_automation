import { z } from 'zod'

const catalogueItemIdsSchema = z
  .array(z.number().int().positive())
  .min(1, 'Wybierz co najmniej jedną pracę')

export const insertCatalogueItemsSchema = z.object({
  sectionId: z.number().int().positive(),
  catalogueItemIds: catalogueItemIdsSchema,
})

export const createSectionWithCatalogueItemsSchema = z.object({
  ownerId: z.number().int().positive(),
  sectionName: z.string().trim().min(1, 'Podaj nazwę sekcji'),
  catalogueItemIds: catalogueItemIdsSchema,
})
