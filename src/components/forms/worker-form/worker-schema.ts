import { z } from 'zod'
import { ROLES } from '@/lib/auth/roles'

export const workerFormSchema = z.object({
  name: z.string().min(1, 'Imię i nazwisko jest wymagane'),
  email: z.union([z.literal(''), z.string().email('Nieprawidłowy adres email')]),
  role: z.enum(ROLES),
  active: z.boolean(),
  defaultCashRegister: z.string(),
})

export type WorkerFormValuesT = z.infer<typeof workerFormSchema>
