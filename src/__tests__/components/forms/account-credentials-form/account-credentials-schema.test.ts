import { describe, it, expect } from 'vitest'
import { accountCredentialsFormSchema } from '@/components/forms/account-credentials-form/account-credentials-schema'

const valid = {
  email: 'jan@test.invalid',
  newPassword: '',
  confirmPassword: '',
  currentPassword: 'stare-haslo',
}

const firstError = (values: typeof valid) =>
  accountCredentialsFormSchema.safeParse(values).error?.issues[0]?.message

describe('accountCredentialsFormSchema', () => {
  it('accepts an empty new password as "keep the current one"', () => {
    expect(accountCredentialsFormSchema.safeParse(valid).success).toBe(true)
  })

  it('refuses a new password shorter than 6 characters', () => {
    expect(firstError({ ...valid, newPassword: '12345', confirmPassword: '12345' })).toBe(
      'Hasło musi mieć co najmniej 6 znaków.',
    )
  })

  it('refuses a repeat that does not match', () => {
    expect(firstError({ ...valid, newPassword: '123456', confirmPassword: '123457' })).toBe(
      'Hasła nie są takie same.',
    )
  })

  it('requires the current password', () => {
    expect(firstError({ ...valid, currentPassword: '' })).toBe('Podaj obecne hasło.')
  })

  it('normalises the e-mail the way Payload stores it', () => {
    expect(accountCredentialsFormSchema.parse({ ...valid, email: ' Jan@Test.INVALID ' }).email).toBe(
      'jan@test.invalid',
    )
  })
})
