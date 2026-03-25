'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import FormFooter from '@/components/forms/form-components/form-footer'
import { investmentFormSchema, type InvestmentFormValuesT } from './investment-schema'
import { createInvestmentAction } from '@/lib/actions/investments'
import type { InvestmentFormDataT } from '@/lib/schemas/investment'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

type AddInvestmentFormPropsT = {
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

const FORM_ID = 'add-investment'

const EMPTY_DEFAULTS: InvestmentFormValuesT = {
  name: '',
  address: '',
  phone: '',
  email: '',
  contactPerson: '',
  notes: '',
  review: '',
  status: 'active',
}

export function AddInvestmentForm({ onSubmitSuccess, keepOpen }: AddInvestmentFormPropsT) {
  const { recoveredValues, submit } = useFormSubmit<InvestmentFormValuesT>(FORM_ID)

  const form = useAppForm({
    defaultValues: recoveredValues ?? EMPTY_DEFAULTS,
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
        action: () => createInvestmentAction(data),
        successMessage: 'Inwestycja dodana',
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

        <FormFooter label="Dodaj" submittingLabel="Dodawanie..." className="mt-6" />
      </form>
    </form.AppForm>
  )
}
