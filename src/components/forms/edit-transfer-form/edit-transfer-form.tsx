'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import {
  showsInvestment,
  needsExpenseCategory,
  EXPENSE_CATEGORY_LABEL,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { editTransferFormSchema } from '@/components/forms/expense-form/expense-schema'
import type { UpdateTransferFormT } from '@/lib/schemas/transfer'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'
import { updateTransferAction } from '@/lib/actions/transfers'
import { DateField, DescriptionField, InvestmentField } from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'

type EditTransferFormPropsT = {
  row: TransferRowT
  referenceData: ReferenceDataBaseT
  onSuccess: () => void
  keepOpen?: boolean
}

type FormValuesT = {
  description: string
  date: string
  paymentMethod: string
  investment: string
  expenseCategory: string
  otherCategory: string
  invoiceNote: string
}

const FORM_ID = 'edit-transfer'

export function EditTransferForm({
  row,
  referenceData,
  onSuccess,
  keepOpen,
}: EditTransferFormPropsT) {
  const { isRecovering, recoveredValues, submit } = useFormSubmit<FormValuesT>(FORM_ID)

  const form = useAppForm({
    defaultValues:
      recoveredValues ??
      ({
        description: row.description,
        date: row.date.slice(0, 10),
        paymentMethod: row.paymentMethod,
        investment: row.investmentId ? String(row.investmentId) : '',
        expenseCategory: row.expenseCategoryId ? String(row.expenseCategoryId) : '',
        otherCategory: row.otherCategoryId ? String(row.otherCategoryId) : '',
        invoiceNote: row.invoiceNote ?? '',
      } as FormValuesT),
    validators: {
      onSubmit: editTransferFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: UpdateTransferFormT = {
        description: value.description,
        date: value.date,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        investment: value.investment ? Number(value.investment) : undefined,
        expenseCategory: value.expenseCategory ? Number(value.expenseCategory) : undefined,
        otherCategory: value.otherCategory ? Number(value.otherCategory) : undefined,
        invoiceNote: value.invoiceNote || undefined,
      }

      await submit(!!keepOpen, {
        action: () => updateTransferAction(row.id, data),
        successMessage: 'Transakcja zaktualizowana',
        formValues: value as unknown as Record<string, unknown>,
        onSuccess,
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
          <DescriptionField form={form} />

          <DateField form={form} />

          {/* Payment method hidden — only CASH is currently used */}

          {showsInvestment(row.type) && (
            <InvestmentField form={form} investments={referenceData.investments} />
          )}

          {needsExpenseCategory(row.type) && (
            <form.AppField name="expenseCategory">
              {(field: AppFieldComponentsT) => (
                <field.Select label={EXPENSE_CATEGORY_LABEL} placeholder="Wybierz typ" showError>
                  {referenceData.expenseCategories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>
          )}

          <form.AppField name="otherCategory">
            {(field: AppFieldComponentsT) => (
              <field.Select label="Kategoria" placeholder="Wybierz kategorię" showError>
                {referenceData.otherCategories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          <form.AppField name="invoiceNote">
            {(field: AppFieldComponentsT) => (
              <field.Textarea label="Notatka" placeholder="Wpisz notatkę..." rows={3} showError />
            )}
          </form.AppField>
        </FieldGroup>

        <FormFooter label="Zapisz" submittingLabel="Zapisywanie..." className="mt-6" />
      </form>
    </form.AppForm>
  )
}
