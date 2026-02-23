'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { loginAction } from '@/lib/actions/auth'

export function LoginForm() {
  const [error, setError] = useState<string>()

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      setError(undefined)
      const response = await loginAction(value)
      if (response.error) {
        setError(response.error)
      }
    },
  })

  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
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

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Logowanie...' : 'Zaloguj'}
      </Button>
    </form>
  )
}
