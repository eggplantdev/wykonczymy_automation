'use client'

import { useState } from 'react'
import { LoaderCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { forgotPasswordAction } from '@/lib/actions/auth'

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
      <div className="flex flex-col items-center gap-2 rounded-md border p-6">
        <Check className="text-green-600" size={32} />
        <p className="text-foreground text-center text-sm">
          Jeśli konto z tym adresem email istnieje, wysłaliśmy link do zresetowania hasła.
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

      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? (
          <>
            <LoaderCircle className="animate-spin" />
            Wysyłanie...
          </>
        ) : (
          'Wyślij link'
        )}
      </Button>
    </form>
  )
}
