import { z } from 'zod'

// Form-input layer: every field is a string, as the HTML controls produce them.
export const investmentFormSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  contactPerson: z.string(),
  notes: z.string(),
  review: z.string(),
  // Accepted so editing the workbench can't rewrite its status; no <SelectItem> offers it, the
  // workbench is only auto-provisioned.
  status: z.enum(['active', 'completed', 'planowana', 'szablon']),
  // Optional seed template, only meaningful on create ('' = start empty). Not an investments
  // column — createInvestmentAction strips it and seeds the new investment's kosztorys from it.
  presetId: z.string(),
})

export type InvestmentFormValuesT = z.infer<typeof investmentFormSchema>

// Domain layer the action validates: derived from the form schema so the field
// list can't drift; optional text fields default to '' and email is validated.
export const investmentSchema = investmentFormSchema.extend({
  address: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  email: z
    .union([z.literal(''), z.email('Nieprawidłowy adres email')])
    .optional()
    .default(''),
  contactPerson: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  review: z.string().optional().default(''),
  // Not a form value — no control collects it. The files are uploaded before submit and the ids
  // ride in on the action call (`submitWithInvoicePages`), so only the domain layer knows the field.
  assets: z.array(z.number()).optional().default([]),
})

// `z.input`, not `z.infer`: `assets` is supplied by the submit wrapper rather than by the form, so
// a caller must be allowed to omit it. The action re-parses with `investmentSchema`, which is where
// the defaults land.
export type InvestmentFormDataT = z.input<typeof investmentSchema>
