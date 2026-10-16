import { z } from 'zod'

export const duplicateOfSchema = z.object({
  source: z.enum(['transaction', 'draft']),
  id: z.number().int().positive(),
})

export type DuplicateOfT = z.infer<typeof duplicateOfSchema>

export const skippedReceiptSchema = z.object({
  mediaIds: z.array(z.number().int().positive()),
  readRow: z.number().int().nonnegative().optional(),
  duplicateOf: duplicateOfSchema.optional(),
})

export type SkippedReceiptT = z.infer<typeof skippedReceiptSchema>
