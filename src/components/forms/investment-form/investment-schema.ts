import { z } from 'zod'

export const investmentFormSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  contactPerson: z.string(),
  notes: z.string(),
  review: z.string(),
  status: z.enum(['active', 'completed']),
})

export type InvestmentFormValuesT = z.infer<typeof investmentFormSchema>
