import { z } from 'zod'

/**
 * Wire shape of a single-cell autosave — every field optional, because the grid diffs a row into one
 * entry per field and fires one call per entry.
 *
 * Beside `ItemPatchT` (types.ts) rather than inside the action, so the coercion contract below can be
 * asserted without a `'use server'` module: a server-action file may export nothing but async
 * functions, which put this schema out of a test's reach.
 */
export const itemPatchSchema = z
  .object({
    description: z.string().nullable(),
    unit: z.string().nullable(),
    plannedQty: z.coerce.number(),
    discountType: z.enum(['percent', 'amount']).nullable(),
    // Floor only: the same slot carries złotówki when the type is 'amount', so the percent ceiling
    // lives in discount-edit.ts.
    discountValue: z.coerce.number().min(0),
    clientPrice: z.coerce.number(),
    // `.nullable()` WRAPS the coercion rather than following a coerced number: `z.coerce.number()`
    // turns null into 0, which is the one value that must stay distinguishable from „auto".
    wToolsOverrideValue: z.coerce.number().nullable(),
    ownToolsOverrideValue: z.coerce.number().nullable(),
    // Same `.nullable()` wrapping, same reason: a mnożnik of 0 is a stawka of zero złotych.
    wToolsOverrideCoeff: z.coerce.number().nullable(),
    ownToolsOverrideCoeff: z.coerce.number().nullable(),
    note: z.string().nullable(),
  })
  .partial()
