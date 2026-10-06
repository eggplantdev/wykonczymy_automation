import { z } from 'zod'

// What the AI read from a worker's draft at send, in page order: one row for „Jeden wydatek", one
// per photo for „Kilka wydatków". A row the AI could not read carries only its pages, so the
// manager still gets a blank row for that photo.
const expenseDraftReadRowSchema = z.object({
  mediaIds: z.array(z.number().int()),
  description: z.string().optional(),
  amount: z.number().optional(),
  netAmount: z.number().optional(),
  invoiceNote: z.string().optional(),
  filename: z.string().optional(),
})

export const expenseDraftReadSchema = z.object({ rows: z.array(expenseDraftReadRowSchema) })

export type ExpenseDraftReadRowT = z.infer<typeof expenseDraftReadRowSchema>
export type ExpenseDraftReadT = z.infer<typeof expenseDraftReadSchema>
