import { z } from 'zod'
import { passwordSchema, PASSWORD_MISMATCH_MESSAGE } from '@/lib/schemas/password'

// Normalised as Payload stores it, so the clash check and the "nothing changed" test read the stored form.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Nieprawidłowy adres email'))

// An empty new password means "keep the current one".
const newPasswordSchema = z.union([z.literal(''), passwordSchema])

export const accountCredentialsSchema = z.object({
  email: emailSchema,
  newPassword: newPasswordSchema.optional(),
  currentPassword: z.string().min(1, 'Podaj obecne hasło.'),
})

export type AccountCredentialsInputT = z.infer<typeof accountCredentialsSchema>

export const accountCredentialsFormSchema = accountCredentialsSchema
  .extend({ newPassword: newPasswordSchema, confirmPassword: z.string() })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: PASSWORD_MISMATCH_MESSAGE,
    path: ['confirmPassword'],
  })

export type AccountCredentialsFormValuesT = z.input<typeof accountCredentialsFormSchema>
