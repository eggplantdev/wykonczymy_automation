import { z } from 'zod'
import { INVESTMENT_STATUSES } from '@/lib/constants/investment-status'

export const investmentFormSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  contactPerson: z.string(),
  notes: z.string(),
  reviewRequested: z.boolean(),
  status: z.enum(INVESTMENT_STATUSES),
  presetId: z.string(),
})

export type InvestmentFormValuesT = z.infer<typeof investmentFormSchema>

export const investmentSchema = investmentFormSchema.extend({
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z
    .union([z.literal(''), z.email('Nieprawidłowy adres email')])
    .optional()
    .default(''),
  contactPerson: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  reviewRequested: z.boolean().optional().default(false),
  assets: z.array(z.number()).optional().default([]),
})

// `z.input`, not `z.infer`: `assets` is supplied by the submit wrapper rather than by the form, so
// a caller must be allowed to omit it.
export type InvestmentFormDataT = z.input<typeof investmentSchema>

export const investmentClientFieldsSchema = investmentSchema.pick({
  contactPerson: true,
  address: true,
})

export type InvestmentClientFieldsT = z.input<typeof investmentClientFieldsSchema>
