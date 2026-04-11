'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import {
  DEPOSIT_UI_TYPES,
  TRANSFER_TYPE_LABELS,
  showsInvestment,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { expenseFormSchema } from '@/components/forms/expense-form/expense-schema'
import type { CreateTransferFormT } from '@/lib/schemas/transfer'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister } from '@/lib/utils/default-cash-register'
import { today } from '@/lib/date-utils'
import {
  AmountField,
  CashRegisterField,
  DateField,
  DescriptionField,
  EntityComboboxField,
  // PaymentMethodField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormClearButton } from '../form-components/form-clear-button'
import { createTransferAction } from '@/lib/actions/transfers'
import { useDepositFormStore } from '@/stores/form-stores'

type DepositFormPropsT = {
  referenceData: ReferenceDataT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

type FormValuesT = {
  description: string
  amount: string
  date: string
  type: string
  paymentMethod: string
  sourceRegister: string
  investment?: string
}

const FORM_ID = 'deposit'

export function DepositForm({ referenceData, onSubmitSuccess, keepOpen }: DepositFormPropsT) {
  // COMPANY_FUNDING visible only to admin/owner — managers see other deposit types
  const depositTypes = isAdminOrOwnerRole(referenceData.currentUserRole)
    ? DEPOSIT_UI_TYPES
    : DEPOSIT_UI_TYPES.filter((t) => t !== 'COMPANY_FUNDING')

  const { submit } = useFormSubmit(FORM_ID)

  const storedValues = useDepositFormStore((s) => s.formData)
  const updateFormData = useDepositFormStore((s) => s.updateFormData)
  const resetFormData = useDepositFormStore((s) => s.resetFormData)

  const form = useAppForm({
    defaultValues:
      storedValues ??
      ({
        description: '',
        amount: '',
        date: today(),
        type: 'INVESTOR_DEPOSIT',
        paymentMethod: 'CASH',
        sourceRegister: getDefaultCashRegister(referenceData),
        investment: '',
      } as FormValuesT),
    validators: {
      onSubmit: expenseFormSchema,
    },
    listeners: {
      onChange: ({ formApi }) => updateFormData(formApi.state.values as FormValuesT),
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      const data: CreateTransferFormT = {
        description: value.description,
        amount: Number(value.amount),
        date: value.date,
        type: value.type as CreateTransferFormT['type'],
        paymentMethod: value.paymentMethod as PaymentMethodT,
        sourceRegister: Number(value.sourceRegister),
        investment: value.investment ? Number(value.investment) : undefined,
      }

      await submit(!!keepOpen, {
        form,
        action: () => createTransferAction(data),
        successMessage: 'Wpłata dodana',
        onSubmitSuccess,
        onReset: resetFormData,
      })

      return false
    },
  })

  useCheckFormErrors(form)

  const currentType = useStore(form.store, (s) => s.values.type)

  return (
    <form.AppForm>
      <FormClearButton onReset={resetFormData} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          {/* Type */}
          <form.AppField name="type" listeners={{ onChange: () => form.resetField('investment') }}>
            {(field) => (
              <field.Select label="Typ wpłaty" showError>
                {depositTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSFER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          <DescriptionField form={form} placeholder="Opis wpłaty" />

          <div className="flex items-start gap-4">
            <AmountField form={form} fieldClassName="min-w-0 flex-1" />
            <DateField form={form} fieldClassName="w-40" />
          </div>

          {/* Payment method — temporarily hidden, always CASH */}
          {/* <PaymentMethodField form={form} /> */}

          <CashRegisterField form={form} cashRegisters={referenceData.cashRegisters} />

          {/* Conditional: Investment — required for INVESTOR_DEPOSIT, optional for others */}
          {showsInvestment(currentType) && (
            <EntityComboboxField
              form={form}
              name="investment"
              items={referenceData.investments}
              label="Inwestycja"
              placeholder="Wybierz inwestycję"
              searchPlaceholder="Szukaj inwestycji..."
              emptySearchMessage="Nie znaleziono inwestycji."
              noItemsMessage="Brak inwestycji"
              noActiveItemsMessage="Brak aktywnych inwestycji"
            />
          )}
        </FieldGroup>

        <FormFooter className="mt-6" />
      </form>
    </form.AppForm>
  )
}
