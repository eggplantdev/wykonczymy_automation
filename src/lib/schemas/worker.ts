import { z } from 'zod'
import { ROLES } from '@/lib/auth/roles'

export const workerSchema = z.object({
  name: z.string().min(1, 'Imię i nazwisko jest wymagane'),
  email: z.union([z.literal(''), z.string().email('Nieprawidłowy adres email')]).default(''),
  role: z.enum(ROLES),
  active: z.boolean(),
  defaultCashRegister: z.number().optional(),
})

export type WorkerFormDataT = z.infer<typeof workerSchema>
