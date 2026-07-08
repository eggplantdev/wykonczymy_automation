'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useStore } from '@/components/forms/hooks/form-hooks'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
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
} from '@/components/forms/form-fields'
import FormFooter from '../form-components/form-footer'
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

  const { form, reset } = useManagedForm<FormValuesT, CreateTransferFormT>({
    formId: FORM_ID,
    store: useDepositFormStore,
    schema: expenseFormSchema,
    defaultValues: {
      description: '',
      amount: '',
      date: today(),
      type: 'INVESTOR_DEPOSIT',
      paymentMethod: 'CASH',
      sourceRegister: getDefaultCashRegister(referenceData),
      investment: '',
    },
    keepOpen,
    successMessage: 'Wpłata dodana',
    onSubmitSuccess,
    action: createTransferAction,
    toData: (value) => ({
      description: value.description,
      amount: Number(value.amount),
      date: value.date,
      type: value.type as CreateTransferFormT['type'],
      paymentMethod: value.paymentMethod as PaymentMethodT,
      sourceRegister: Number(value.sourceRegister),
      investment: value.investment ? Number(value.investment) : undefined,
    }),
  })

  const currentType = useStore(form.store, (s) => s.values.type)

  return (
    <FormShell form={form} onReset={reset}>
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

        <CashRegisterField form={form} cashRegisters={referenceData.cashRegisters} />

        {/* Conditional: Investment — required for INVESTOR_DEPOSIT, optional for others */}
        {showsInvestment(currentType) && (
          <EntityComboboxField form={form} variant="investment" items={referenceData.investments} />
        )}
      </FieldGroup>

      <FormFooter className="mt-6" />
    </FormShell>
  )
}
