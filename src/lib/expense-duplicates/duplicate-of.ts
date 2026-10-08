import { z } from 'zod'

// What management marked a refused paragon a duplicate of (EX-1025).
export const duplicateOfSchema = z.object({
  source: z.enum(['transaction', 'draft']),
  id: z.number().int().positive(),
})

export type DuplicateOfT = z.infer<typeof duplicateOfSchema>

// A paragon management left out of an acceptance; `duplicateOf` when it was left out as a duplicate.
export const skippedReceiptSchema = z.object({
  mediaIds: z.array(z.number().int().positive()),
  duplicateOf: duplicateOfSchema.optional(),
})

export type SkippedReceiptT = z.infer<typeof skippedReceiptSchema>

export const duplicateOfLabel = ({ source, id }: DuplicateOfT) =>
  source === 'transaction' ? `Duplikat #${id}` : `Duplikat zgłoszenia #${id}`
