import type { ZodType } from 'zod'
import type { UseBoundStore, StoreApi } from 'zustand'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import {
  useSubmitConfirm,
  type SubmitConfirmCopyT,
} from '@/components/forms/hooks/use-submit-confirm'
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
  toData: (values: TValues) => TData
  action: (data: TData) => Promise<ActionResultT>
  onSaved?: (data: TData) => void
  onReset?: () => void
  keepAfterSave?: (keyof TValues & string)[]
  mergeStored?: (stored: TValues) => TValues
  confirmBeforeSubmit?: (values: TValues) => SubmitConfirmCopyT | null
  beforeSubmit?: (values: TValues) => Promise<boolean>
  /**
   * An EDIT form must pass `false`: a restored draft silently
   * reverts whatever changed in the meantime in fields the user never touched.
   */
  persistDraft?: boolean
}

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
  onSaved,
  onReset,
  keepAfterSave,
  mergeStored,
  confirmBeforeSubmit,
  beforeSubmit,
  persistDraft = true,
}: UseManagedFormArgsT<TValues, TData>) {
  const { submit } = useFormSubmit(formId)
  const { ask, dialogProps } = useSubmitConfirm()

  const storedFormId = useFormStore((s) => s.formId)
  const storedValues = useFormStore((s) => s.formData)
  const updateFormData = useFormStore((s) => s.updateFormData)
  const resetFormData = useFormStore((s) => s.resetFormData)

  const reset = () => {
    // `defaultValues`, never `initialValues` — the latter is the restored draft, so a bare
    // `form.reset()` hands back the values that were just submitted.
    form.reset(defaultValues)
    // Clearing the single slot is only ours to do if we wrote it — an edit form doing so would drop
    // an unrelated „Dodaj…" draft still in progress.
    if (persistDraft) resetFormData()
    onReset?.()
  }

  // „Dodaj pojazd" and „Edytuj pojazd 7" share one
  // store slot, so without this an abandoned add-draft would win over the record being edited.
  const draft = persistDraft && storedFormId === formId ? storedValues : null

  // Spread over `defaultValues` rather than replacing them: a draft written before this release knows
  // nothing of a field the release added, and TanStack Form takes its field set from the initial
  // values — so a restored draft would hand `undefined` to that field's input and crash it.
  const initialValues =
    draft === null ? defaultValues : { ...defaultValues, ...(mergeStored?.(draft) ?? draft) }

  const form = useAppForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: schema,
    },
    listeners: {
      onChange: ({ formApi }) => {
        if (persistDraft) updateFormData(formId, formApi.state.values as TValues)
      },
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      const copy = confirmBeforeSubmit?.(value as TValues)
      if (copy && !(await ask(copy))) return false
      if (beforeSubmit && !(await beforeSubmit(value as TValues))) return false

      const data = toData(value as TValues)
      await submit(!!keepOpen, {
        action: () => action(data),
        successMessage,
        onSubmitSuccess,
        onSaved: onSaved && (() => onSaved(data)),
        onReset: () => {
          reset()
          if (keepOpen) carryOver(value as TValues)
        },
        awaitBeforeClose: !persistDraft,
      })

      return false
    },
  })

  // Set after the reset, never folded into it: reset adopts its values as the new defaults, and the
  // next render's `defaultValues` would differ and be swapped back in over the untouched form.
  function carryOver(saved: TValues) {
    keepAfterSave?.forEach((field) =>
      form.setFieldValue(field, saved[field] as never, {
        dontUpdateMeta: true,
        dontRunListeners: true,
      }),
    )
  }

  useCheckFormErrors(form)

  return {
    form,
    reset,
    submitConfirm: dialogProps,
  }
}
