'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { resetPasswordAction } from '@/lib/actions/auth'
import { settleAction } from '@/lib/utils/settle-action'
import { AuthSubmitButton } from '@/components/ui/auth-submit-button'
import { AuthSuccessCard } from '@/components/ui/auth-success-card'
import { passwordSchema, PASSWORD_MISMATCH_MESSAGE } from '@/lib/schemas/password'

type FormStateT = 'idle' | 'pending' | 'success'

export function ResetPasswordForm() {
  const [error, setError] = useState<string>()
  const [formState, setFormState] = useState<FormStateT>('idle')
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const form = useAppForm({
    defaultValues: { password: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      setError(undefined)

      if (value.password !== value.confirmPassword) {
        setFormState('idle')
        setError(PASSWORD_MISMATCH_MESSAGE)
        return
      }

      const password = passwordSchema.safeParse(value.password)
      if (!password.success) {
        setFormState('idle')
        setError(password.error.issues[0]?.message)
        return
      }

      const response = await settleAction(() =>
        resetPasswordAction({ token: token ?? '', password: value.password }),
      )

      if (response.success) {
        setFormState('success')
        setTimeout(() => router.push('/zaloguj'), 2000)
      } else {
        setFormState('idle')
        setError(response.error)
      }
    },
  })

  if (!token) {
    return (
      <p className="text-destructive text-center text-sm">
        Brak tokenu resetowania. Sprawdź link z wiadomości email.
      </p>
    )
  }

  if (formState === 'success') {
    return <AuthSuccessCard message="Hasło zostało zmienione. Przekierowujemy do logowania..." />
  }

  const isPending = formState === 'pending'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (isPending) return
        setFormState('pending')
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="password">
        {(field) => (
          <field.Input
            label="Nowe hasło"
            type="password"
            autoComplete="new-password"
            showError
            className="text-base"
          />
        )}
      </form.AppField>

      <form.AppField name="confirmPassword">
        {(field) => (
          <field.Input
            label="Powtórz hasło"
            type="password"
            autoComplete="new-password"
            showError
            className="text-base"
          />
        )}
      </form.AppField>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <AuthSubmitButton
        isPending={isPending}
        idleText="Zapisz nowe hasło"
        pendingText="Zapisywanie..."
      />
    </form>
  )
}
