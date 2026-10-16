import { AnyFormApi, useStore } from '@tanstack/react-form'

type UseFormStatusResultT = {
  isSubmitting: boolean
  isInvalid: boolean
  isValid: boolean
  canSubmit: boolean
}

export function useFormStatus(form: AnyFormApi): UseFormStatusResultT {
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const isValid = useStore(form.store, (s) => s.isValid)
  const canSubmit = useStore(form.store, (s) => s.canSubmit)
  const submissionAttempts = useStore(form.store, (s) => s.submissionAttempts)

  const isInvalid = submissionAttempts > 0 && !isValid

  return { isSubmitting, isInvalid, isValid, canSubmit }
}
