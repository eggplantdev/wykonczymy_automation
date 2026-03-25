import { z } from 'zod'

export const investmentSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z
    .union([z.literal(''), z.string().email('Nieprawidłowy adres email')])
    .optional()
    .default(''),
  contactPerson: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  review: z.string().optional().default(''),
  status: z.enum(['active', 'completed']),
})

export type InvestmentFormDataT = z.infer<typeof investmentSchema>
