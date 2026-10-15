import { z } from 'zod'
import { workCatalogueItemSchema } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { insertDirectionSchema } from '@/lib/kosztorys/display-order'

const newItemPlacementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('end'), sectionId: z.number().int() }),
  z.object({
    kind: z.literal('next-to'),
    anchorItemId: z.number().int(),
    dir: insertDirectionSchema,
  }),
])

export const addItemSchema = z.object({
  placement: newItemPlacementSchema,
  // The katalog's own domain schema, not a copy: the dialog's praca and a katalog entry are the same
  // fields, and `insertItems` bypasses Payload's field rules, so this is the only backstop against a
  // negative cena or both columns of one płaszczyzna set.
  data: workCatalogueItemSchema,
  catalogue: z
    .object({
      mode: z.enum(['new', 'overwrite']),
      keepCatalogueCategory: z.boolean(),
      workNote: z.string().optional(),
    })
    .nullable(),
  // „Tłumacz automatycznie przy pomocy AI" — off unless the dialog asks, so no other caller pays an AI wait.
  translate: z.boolean().optional(),
})

export type AddItemInputT = z.infer<typeof addItemSchema>

// A szablon praca with no katalog entry would be the only one whose content lives nowhere else
// (EX-1017).
export const TEMPLATE_ITEM_NEEDS_CATALOGUE = 'Praca w szablonie musi być w katalogu prac.'
