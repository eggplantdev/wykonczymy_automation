import { z } from 'zod'

import { randomId } from '@/lib/utils/random-id'

// Trim before validating, not after: a pasted address arrives with a trailing space often enough
// that rejecting it would read as a bug, and storing it would mail nobody.
const recipientEmailSchema = z.string().trim().pipe(z.email('Nieprawidłowy adres e-mail'))

const AT_LEAST_ONE = 'Lista musi mieć co najmniej jednego odbiorcę'

// What the server action re-checks: the same two rules against the plain address list it receives.
// Written beside the form's own shape so the two cannot drift into different messages. The dedupe is
// what keeps the stored list keyable by address on the card — and one delivery per person.
export const recipientEmailsSchema = z
  .array(recipientEmailSchema)
  .min(1, AT_LEAST_ONE)
  .transform((emails) => [...new Set(emails)])

// Rows carry an `id` only so React can key them across adds and removes — the index would reorder
// under a removal and re-key every input below it, blurring the one being typed in.
export const recipientListFormSchema = z.object({
  emails: z.array(z.object({ id: z.string(), email: recipientEmailSchema })).min(1, AT_LEAST_ONE),
})

export type RecipientListFormValuesT = z.infer<typeof recipientListFormSchema>

export const makeRecipientRow = (email = ''): RecipientListFormValuesT['emails'][number] => ({
  id: randomId(),
  email,
})
