import { z } from 'zod'
import { POLISH_ACCOUNT, type TranslatorT } from '@/lib/i18n/translations'

const PASSWORD_MIN_LENGTH = 6

export const buildPasswordSchema = ({ t }: TranslatorT<'account'> = POLISH_ACCOUNT) =>
  z.string().min(PASSWORD_MIN_LENGTH, t('passwordTooShort', { min: PASSWORD_MIN_LENGTH }))

export const passwordSchema = buildPasswordSchema()

export const PASSWORD_MISMATCH_MESSAGE = POLISH_ACCOUNT.t('passwordMismatch')
