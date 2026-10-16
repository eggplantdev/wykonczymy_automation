import { z } from 'zod'

import { randomId } from '@/lib/utils/random-id'

const recipientEmailSchema = z.string().trim().pipe(z.email('Nieprawidłowy adres e-mail'))

const AT_LEAST_ONE = 'Lista musi mieć co najmniej jednego odbiorcę'

export const recipientEmailsSchema = z
  .array(recipientEmailSchema)
  .min(1, AT_LEAST_ONE)
  .transform((emails) => [...new Set(emails)])

export const recipientListFormSchema = z.object({
  emails: z.array(z.object({ id: z.string(), email: recipientEmailSchema })).min(1, AT_LEAST_ONE),
})

export type RecipientListFormValuesT = z.infer<typeof recipientListFormSchema>

export const makeRecipientRow = (email = ''): RecipientListFormValuesT['emails'][number] => ({
  id: randomId(),
  email,
})
