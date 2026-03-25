'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import FormFooter from '@/components/forms/form-components/form-footer'
import {
  investmentFormSchema,
  type InvestmentFormValuesT,
} from './investment-schema'
import { updateInvestmentAction } from '@/lib/actions/investments'
import type { InvestmentFormDataT } from '@/lib/schemas/investment'
import type { InvestmentRefT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type EditInvestmentFormPropsT = {
  investment: InvestmentRefT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

export function EditInvestmentForm({
  investment,
  onSubmitSuccess,
  keepOpen,
}: EditInvestmentFormPropsT) {
  const formId = `edit-investment-${investment.id}`
  const { recoveredValues, submit } = useFormSubmit<InvestmentFormValuesT>(formId)

  const form = useAppForm({
    defaultValues:
      recoveredValues ??
      ({
        name: investment.name,
        address: investment.address,
        phone: investment.phone,
        email: investment.email,
        contactPerson: investment.contactPerson,
        notes: investment.notes,
        review: investment.review,
        status: investment.status,
      } as InvestmentFormValuesT),
    validators: {
      onSubmit: investmentFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: InvestmentFormDataT = {
        name: value.name,
        address: value.address,
        phone: value.phone,
        email: value.email,
        contactPerson: value.contactPerson,
        notes: value.notes,
        review: value.review,
        status: value.status,
      }

      await submit(!!keepOpen, {
        action: () => updateInvestmentAction(investment.id, data),
        successMessage: 'Inwestycja zaktualizowana',
        formValues: value as Record<string, unknown>,
        onSubmitSuccess,
        onKeepOpenSuccess: () => form.reset(),
      })

      return false
    },
  })

  useCheckFormErrors(form)

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
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

        <FormFooter label="Zapisz" submittingLabel="Zapisywanie..." className="mt-6" />
      </form>
    </form.AppForm>
  )
}
