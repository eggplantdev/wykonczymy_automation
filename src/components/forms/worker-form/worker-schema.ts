import { z } from 'zod'
import { ROLES } from '@/lib/auth/roles'
import { languageSchema, storedLanguageSchema } from '@/lib/i18n/languages'

export const workerFormSchema = z.object({
  name: z.string().min(1, 'Imię i nazwisko jest wymagane'),
  email: z.union([z.literal(''), z.email('Nieprawidłowy adres email')]),
  role: z.enum(ROLES),
  active: z.boolean(),
  canAddExpensesWithoutInvestment: z.boolean(),
  defaultCashRegister: z.string(),
  language: languageSchema,
})

export type WorkerFormValuesT = z.infer<typeof workerFormSchema>

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
