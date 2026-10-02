'use client'

import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { requestReviewAction } from '@/lib/actions/review-request'
import { useRequestReviewFormStore } from '@/stores/form-stores'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { requestReviewSchema, type RequestReviewValuesT } from './request-review-schema'

type RequestReviewFormPropsT = {
  formId: string
  investmentId: number
  email: string
  onSubmitSuccess: () => void
}

export function RequestReviewForm({
  formId,
  investmentId,
  email,
  onSubmitSuccess,
}: RequestReviewFormPropsT) {
  const closeDialog = useOptimisticFormStore((s) => s.closeDialog)
  const { form } = useManagedForm<RequestReviewValuesT, RequestReviewValuesT>({
    formId,
    useFormStore: useRequestReviewFormStore,
    schema: requestReviewSchema,
    defaultValues: { email },
    successMessage: 'Wysłano prośbę o opinię',
    onSubmitSuccess,
    // The address is saved to the investment on send — a draft would only shadow that.
    persistDraft: false,
    toData: (value) => value,
    action: (data) => requestReviewAction(investmentId, data.email),
  })

  return (
    <FormShell form={form}>
      <FieldGroup>
        <form.AppField name="email">
          {(field) => (
            <field.Input label="Email klienta" type="email" placeholder="Adres email" showError />
          )}
        </form.AppField>
      </FieldGroup>

      <FormFooter
        label="Wyślij"
        submittingLabel="Wysyłanie…"
        className="mt-6"
        onCancel={closeDialog}
      />
    </FormShell>
  )
}
