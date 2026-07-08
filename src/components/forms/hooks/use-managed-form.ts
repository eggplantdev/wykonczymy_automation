import type { ZodType } from 'zod'
import type { UseBoundStore, StoreApi } from 'zustand'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import type { FormStoreT } from '@/stores/create-form-store'
import type { ActionResultT } from '@/types/action'

type FormStoreHookT<TValues> = UseBoundStore<StoreApi<FormStoreT<TValues>>>

type UseManagedFormArgsT<TValues, TData> = {
  formId: string
  useFormStore: FormStoreHookT<TValues>
  schema: ZodType<unknown, TValues>
  defaultValues: TValues
  keepOpen?: boolean
  successMessage: string
  onSubmitSuccess: () => void
  /** Map the string-typed form values to the action's domain payload. */
  toData: (values: TValues) => TData
  action: (data: TData) => Promise<ActionResultT>
  /** Extra cleanup run alongside clearing the persisted form data (e.g. reset saldo). */
  onReset?: () => void
}

/**
 * Encapsulates the wiring every transfer form repeats: the session-store selector
 * triplet, the useAppForm config (persisted onChange + onSubmit → mapped submit),
 * and the error-focus hook. Callers keep only their fields + data mapping.
 */
export function useManagedForm<TValues, TData>({
  formId,
  useFormStore,
  schema,
  defaultValues,
  keepOpen,
  successMessage,
  onSubmitSuccess,
  toData,
  action,
  onReset,
}: UseManagedFormArgsT<TValues, TData>) {
  const { submit } = useFormSubmit(formId)

  const storedValues = useFormStore((s) => s.formData)
  const updateFormData = useFormStore((s) => s.updateFormData)
  const resetFormData = useFormStore((s) => s.resetFormData)

  const reset = () => {
    resetFormData()
    onReset?.()
  }

  const form = useAppForm({
    defaultValues: storedValues ?? defaultValues,
    validators: {
      onSubmit: schema,
    },
    listeners: {
      onChange: ({ formApi }) => updateFormData(formApi.state.values as TValues),
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      await submit(!!keepOpen, {
        form,
        action: () => action(toData(value as TValues)),
        successMessage,
        onSubmitSuccess,
        onReset: reset,
      })

      return false
    },
  })

  useCheckFormErrors(form)

  return { form, reset }
}
