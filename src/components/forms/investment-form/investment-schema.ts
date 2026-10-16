import { z } from 'zod'
import { INVESTMENT_STATUSES } from '@/lib/constants/investment-status'
import { INVESTMENT_CLIENT_TYPES } from '@/lib/constants/investment-client-type'

const billingFormSchema = z.object({
  clientType: z.enum(['', ...INVESTMENT_CLIENT_TYPES]),
  firstName: z.string(),
  lastName: z.string(),
  companyName: z.string(),
  nip: z.string(),
  representative: z.string(),
  sameAsSite: z.boolean(),
  street: z.string(),
  postalCode: z.string(),
  city: z.string(),
  country: z.string(),
})

export type InvestmentBillingFormValuesT = z.infer<typeof billingFormSchema>

export const investmentFormSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  address: z.string(),
  postalCode: z.string(),
  city: z.string(),
  country: z.string(),
  phone: z.string(),
  email: z.string(),
  contactPerson: z.string(),
  billing: billingFormSchema,
  notes: z.string(),
  reviewRequested: z.boolean(),
  status: z.enum(INVESTMENT_STATUSES),
  presetId: z.string(),
})

export type InvestmentFormValuesT = z.infer<typeof investmentFormSchema>

export const investmentSchema = investmentFormSchema.extend({
  address: z.string().optional().default(''),
  postalCode: z.string().optional().default(''),
  city: z.string().optional().default(''),
  country: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z
    .union([z.literal(''), z.email('Nieprawidłowy adres email')])
    .optional()
    .default(''),
  contactPerson: z.string().optional().default(''),
  // Payload's select rejects '', so „not chosen" goes out as null.
  billing: billingFormSchema
    .extend({
      clientType: billingFormSchema.shape.clientType.transform((value) => value || null),
    })
    .optional(),
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
