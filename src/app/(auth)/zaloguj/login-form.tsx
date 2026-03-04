'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthLink } from '@/components/ui/auth-link'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { loginAction } from '@/lib/actions/auth'
import { Loader } from '@/components/ui/loader/loader'
import { AuthSubmitButton } from '@/components/ui/auth-submit-button'

type ButtonStateT = 'idle' | 'pending' | 'success'

export function LoginForm() {
  const [error, setError] = useState<string>()
  const [buttonState, setButtonState] = useState<ButtonStateT>('idle')
  const router = useRouter()

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      const response = await loginAction(value)
      console.log('response', response)

      if (response.success) {
        setButtonState('success')
        router.push('/')
      } else {
        setButtonState('idle')
        setError(response.error)
      }
    },
  })

  const isPending = buttonState !== 'idle'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (isPending) return
        setButtonState('pending')
        router.prefetch('/')
        form.handleSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <form.AppField name="email">
        {(field) => (
          <field.Input
            label="Email"
            type="email"
            autoComplete="email"
            showError
            className={`text-base`}
          />
        )}
      </form.AppField>

      <form.AppField name="password">
        {(field) => (
          <field.Input
            label="Hasło"
            type="password"
            autoComplete="current-password"
            showError
            className={`text-base`}
          />
        )}
      </form.AppField>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <AuthSubmitButton
        isPending={buttonState === 'pending'}
        isSuccess={buttonState === 'success'}
        idleText="Zaloguj"
        pendingText="Logowanie..."
        successText="Zalogowano"
      />
      <AuthLink href="/zaloguj/zapomniane-haslo">Nie pamiętasz hasła?</AuthLink>
      {isPending && <Loader loading={true} />}
    </form>
  )
}
