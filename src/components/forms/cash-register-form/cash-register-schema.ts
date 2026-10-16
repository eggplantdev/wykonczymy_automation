import { z } from 'zod'

export const cashRegisterFormSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana'),
  owner: z.string().min(1, 'Właściciel jest wymagany'),
  type: z.enum(['MAIN', 'AUXILIARY', 'VIRTUAL', 'WORKER']),
  active: z.boolean(),
})

export type CashRegisterFormValuesT = z.infer<typeof cashRegisterFormSchema>

export const cashRegisterSchema = cashRegisterFormSchema.extend({
  owner: z.number(),
})

export type CashRegisterFormDataT = z.infer<typeof cashRegisterSchema>
