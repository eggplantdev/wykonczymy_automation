import { z } from 'zod'
import { ROLES } from '@/lib/auth/roles'

// Form-input layer: every field is a string/boolean as the HTML controls produce
// them (the cash-register <select> yields a string id).
export const workerFormSchema = z.object({
  name: z.string().min(1, 'Imię i nazwisko jest wymagane'),
  email: z.union([z.literal(''), z.email('Nieprawidłowy adres email')]),
  role: z.enum(ROLES),
  active: z.boolean(),
  defaultCashRegister: z.string(),
})

export type WorkerFormValuesT = z.infer<typeof workerFormSchema>

// Domain layer the action validates: derived from the form schema so the field
// list can't drift; the register id is a number and email defaults to ''.
export const workerSchema = workerFormSchema.extend({
  email: z.union([z.literal(''), z.email('Nieprawidłowy adres email')]).default(''),
  defaultCashRegister: z.number().optional(),
})

export type WorkerFormDataT = z.infer<typeof workerSchema>
