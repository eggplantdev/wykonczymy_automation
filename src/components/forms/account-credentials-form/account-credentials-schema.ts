import { z } from 'zod'
import { passwordSchema, PASSWORD_MISMATCH_MESSAGE } from '@/lib/schemas/password'

// Normalised as Payload stores it, so the clash check and the "nothing changed" test read the stored form.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Nieprawidłowy adres email'))

const currentPasswordSchema = z.string().min(1, 'Podaj obecne hasło.')

// Form-input layer: an empty new password means "keep the current one".
export const accountCredentialsFormSchema = z
  .object({
    email: emailSchema,
    newPassword: z.union([z.literal(''), passwordSchema]),
    confirmPassword: z.string(),
    currentPassword: currentPasswordSchema,
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: PASSWORD_MISMATCH_MESSAGE,
    path: ['confirmPassword'],
  })

export type AccountCredentialsFormValuesT = z.input<typeof accountCredentialsFormSchema>

// Domain layer the action validates.
export const accountCredentialsSchema = z.object({
  email: emailSchema,
  newPassword: passwordSchema.optional(),
  currentPassword: currentPasswordSchema,
})

export type AccountCredentialsInputT = z.infer<typeof accountCredentialsSchema>
