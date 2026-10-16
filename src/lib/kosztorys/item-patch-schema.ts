import { z } from 'zod'
import { descriptionTranslationsSchema } from '@/lib/i18n/description-translations'
import { REVIEW_STATUSES } from '@/lib/kosztorys/review-status'

export const itemPatchSchema = z
  .object({
    description: z.string().nullable(),
    // The whole map, never one language: a json update replaces the column, so a single-language
    // patch would wipe the others.
    descriptionTranslations: descriptionTranslationsSchema,
    unit: z.string().nullable(),
    plannedQty: z.coerce.number(),
    // null means „follows Przedmiar ofertowy", 0 means out of scope.
    currentPlannedQty: z.coerce.number().nullable(),
    discountType: z.enum(['percent', 'amount']).nullable(),
    // Floor only: the same slot carries złotówki when the type is 'amount', so the percent ceiling
    // lives in discount-edit.ts.
    discountValue: z.coerce.number().min(0),
    clientPrice: z.coerce.number(),
    // `.nullable()` WRAPS the coercion rather than following a coerced number: `z.coerce.number()`
    // turns null into 0, which is the one value that must stay distinguishable from „auto".
    wToolsOverrideValue: z.coerce.number().nullable(),
    ownToolsOverrideValue: z.coerce.number().nullable(),
    wToolsOverrideCoeff: z.coerce.number().nullable(),
    ownToolsOverrideCoeff: z.coerce.number().nullable(),
    note: z.string().nullable(),
    changeReason: z.string().nullable(),
    reviewStatus: z.enum(REVIEW_STATUSES).nullable(),
    // The grid only ever lowers it, but undo writes the raised flag back — so not `literal(false)`.
    aiRecheck: z.boolean(),
  })
  .partial()
