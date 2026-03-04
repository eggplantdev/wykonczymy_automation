'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { LoaderCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { resetPasswordAction } from '@/lib/actions/auth'

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
        setError('Hasła nie są takie same.')
        return
      }

      if (value.password.length < 6) {
        setFormState('idle')
        setError('Hasło musi mieć co najmniej 6 znaków.')
        return
      }

      const response = await resetPasswordAction({
        token: token ?? '',
        password: value.password,
      })

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
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border p-6">
        <Check className="text-green-600" size={32} />
        <p className="text-foreground text-center text-sm">
          Hasło zostało zmienione. Przekierowujemy do logowania...
        </p>
      </div>
    )
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

      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Zapisywanie...
          </>
        ) : (
          'Zapisz nowe hasło'
        )}
      </Button>
    </form>
  )
}
