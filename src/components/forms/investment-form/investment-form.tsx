'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { investmentFormSchema, type InvestmentFormValuesT } from './investment-schema'
import { useInvestmentFormStore } from '@/stores/form-stores'
import type { InvestmentFormDataT } from './investment-schema'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'
import type { ActionResultT } from '@/types/action'

type InvestmentFormPropsT = {
  formId: string
  defaultValues: InvestmentFormValuesT
  action: (data: InvestmentFormDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

export function InvestmentForm({
  formId,
  defaultValues,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
}: InvestmentFormPropsT) {
  const { form, reset } = useManagedForm<InvestmentFormValuesT, InvestmentFormDataT>({
    formId,
    useFormStore: useInvestmentFormStore,
    schema: investmentFormSchema,
    defaultValues,
    keepOpen,
    successMessage,
    onSubmitSuccess,
    action,
    toData: (value) => ({
      name: value.name,
      address: value.address,
      phone: value.phone,
      email: value.email,
      contactPerson: value.contactPerson,
      notes: value.notes,
      review: value.review,
      status: value.status,
    }),
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <form.AppField name="name">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Nazwa" placeholder="Nazwa inwestycji" showError />
          )}
        </form.AppField>

        <form.AppField name="address">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Adres" placeholder="Adres inwestycji" showError />
          )}
        </form.AppField>

        <form.AppField name="phone">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Telefon" placeholder="Numer telefonu" showError />
          )}
        </form.AppField>

        <form.AppField name="email">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Email" type="email" placeholder="Adres email" showError />
          )}
        </form.AppField>

        <form.AppField name="contactPerson">
          {(field: AppFieldComponentsT) => (
            <field.Input label="Osoba kontaktowa" placeholder="Imię i nazwisko" showError />
          )}
        </form.AppField>

        <form.AppField name="notes">
          {(field: AppFieldComponentsT) => (
            <field.Textarea label="Notatki" placeholder="Notatki..." rows={3} showError />
          )}
        </form.AppField>

        <form.AppField name="review">
          {(field: AppFieldComponentsT) => (
            <field.Textarea label="Opinia" placeholder="Opinia..." rows={3} showError />
          )}
        </form.AppField>

        <form.AppField name="status">
          {(field: AppFieldComponentsT) => (
            <field.Select label="Status" showError>
              <SelectItem value="active">Aktywna</SelectItem>
              <SelectItem value="completed">Zakończona</SelectItem>
            </field.Select>
          )}
        </form.AppField>
      </FieldGroup>

      <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
    </FormShell>
  )
}
