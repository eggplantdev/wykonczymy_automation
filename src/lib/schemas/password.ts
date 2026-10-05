import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 6

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`)

export const PASSWORD_MISMATCH_MESSAGE = 'Hasła nie są takie same.'
