import { z } from 'zod'

// What management marked a refused paragon a duplicate of (EX-1025).
export const duplicateOfSchema = z.object({
  source: z.enum(['transaction', 'draft']),
  id: z.number().int().positive(),
})

export type DuplicateOfT = z.infer<typeof duplicateOfSchema>

export const duplicateOfLabel = ({ source, id }: DuplicateOfT) =>
  source === 'transaction' ? `Duplikat #${id}` : `Duplikat zgłoszenia #${id}`
