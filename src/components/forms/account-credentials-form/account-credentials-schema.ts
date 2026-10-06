import { z } from 'zod'
import { buildPasswordSchema } from '@/lib/schemas/password'
import { POLISH_ACCOUNT, type TranslatorT } from '@/lib/i18n/translations'

function buildSchemas(translator: TranslatorT<'account'>) {
  const { t } = translator
  // Normalised as Payload stores it, so the clash check and the "nothing changed" test read the stored form.
  const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email(t('invalidEmail')))

  // An empty new password means "keep the current one".
  const newPasswordSchema = z.union([z.literal(''), buildPasswordSchema(translator)])

  const credentials = z.object({
    email: emailSchema,
    newPassword: newPasswordSchema.optional(),
    currentPassword: z.string().min(1, t('currentPasswordRequired')),
  })

  const form = credentials
    .extend({ newPassword: newPasswordSchema, confirmPassword: z.string() })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: t('passwordMismatch'),
      path: ['confirmPassword'],
    })

  return { credentials, form }
}

export const buildAccountCredentialsFormSchema = (translator: TranslatorT<'account'>) =>
  buildSchemas(translator).form

const POLISH_SCHEMAS = buildSchemas(POLISH_ACCOUNT)

export const accountCredentialsSchema = POLISH_SCHEMAS.credentials

export type AccountCredentialsInputT = z.infer<typeof accountCredentialsSchema>

export const accountCredentialsFormSchema = POLISH_SCHEMAS.form

export type AccountCredentialsFormValuesT = z.input<typeof accountCredentialsFormSchema>
