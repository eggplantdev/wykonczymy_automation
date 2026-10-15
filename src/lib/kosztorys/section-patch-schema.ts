import { z } from 'zod'
import { isSectionColorKey, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'

export const sectionPatchSchema = z
  .object({
    name: z.string(),
    displayOrder: z.coerce.number().int().min(0),
    // null clears the pin (back to the pie's positional palette).
    color: z.custom<SectionColorKeyT>(isSectionColorKey).nullable(),
  })
  .partial()

export type SectionPatchT = z.infer<typeof sectionPatchSchema>
