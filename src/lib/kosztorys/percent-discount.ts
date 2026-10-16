import { z } from 'zod'

export const applyPercentDiscountSchema = z.object({
  percent: z.coerce.number().min(0).max(100),
})
