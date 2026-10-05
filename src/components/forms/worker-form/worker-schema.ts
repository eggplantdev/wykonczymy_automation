import { z } from 'zod'
import { ROLES } from '@/lib/auth/roles'
import { languageSchema, storedLanguageSchema } from '@/lib/i18n/languages'

// Form-input layer: every field is a string/boolean as the HTML controls produce
// them (the cash-register <select> yields a string id).
export const workerFormSchema = z.object({
  name: z.string().min(1, 'Imię i nazwisko jest wymagane'),
  email: z.union([z.literal(''), z.email('Nieprawidłowy adres email')]),
  role: z.enum(ROLES),
  active: z.boolean(),
  defaultCashRegister: z.string(),
  // „Polski” is a real option in the select, so the form never holds an empty language.
  language: languageSchema,
})

export type WorkerFormValuesT = z.infer<typeof workerFormSchema>

// Domain layer the action validates: derived from the form schema so the field
// list can't drift; the register id is a number and email defaults to ''.
export const workerSchema = workerFormSchema.extend({
  // Normalised here because the action's clash check and the write must read the same value.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.union([z.literal(''), z.email('Nieprawidłowy adres email')]))
    .default(''),
  defaultCashRegister: z.number().optional(),
  language: storedLanguageSchema,
})

export type WorkerFormDataT = z.infer<typeof workerSchema>
