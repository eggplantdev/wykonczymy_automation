'use client'

import { useState } from 'react'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { forgotPasswordAction } from '@/lib/actions/auth'
import { AuthSubmitButton } from '@/components/ui/auth-submit-button'
import { AuthSuccessCard } from '@/components/ui/auth-success-card'

type FormStateT = 'idle' | 'pending' | 'success'

export function ForgotPasswordForm() {
  const [formState, setFormState] = useState<FormStateT>('idle')

  const form = useAppForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      await forgotPasswordAction(value)
      setFormState('success')
    },
  })

  if (formState === 'success') {
    return (
      <AuthSuccessCard message="Jeśli konto z tym adresem email istnieje, wysłaliśmy link do zresetowania hasła." />
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
      <form.AppField name="email">
        {(field) => (
          <field.Input
            label="Email"
            type="email"
            autoComplete="email"
            showError
            className="text-base"
          />
        )}
      </form.AppField>

      <AuthSubmitButton isPending={isPending} idleText="Wyślij link" pendingText="Wysyłanie..." />
    </form>
  )
}
