'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import {
  DEPOSIT_UI_TYPES,
  TRANSFER_TYPE_LABELS,
  requiresInvestment,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { transferFormSchema } from '@/components/forms/expense-form/expense-schema'
import type { CreateTransferFormT } from '@/lib/schemas/transfer'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister } from '@/lib/utils/default-cash-register'
import { today } from '@/lib/date-utils'
import {
  AmountField,
  CashRegisterField,
  DateField,
  DescriptionField,
  InvestmentField,
  // PaymentMethodField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { createTransferAction } from '@/lib/actions/transfers'

type DepositFormPropsT = {
  referenceData: ReferenceDataT
  onSuccess: () => void
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

export function DepositForm({ referenceData, onSuccess, keepOpen }: DepositFormPropsT) {
  const { isRecovering, recoveredValues, submit } = useFormSubmit<FormValuesT>(FORM_ID)

  const form = useAppForm({
    defaultValues:
      recoveredValues ??
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
      onSubmit: transferFormSchema,
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
        action: () => createTransferAction(data, null),
        successMessage: 'Wpłata dodana',
        formValues: value as unknown as Record<string, unknown>,
        onSuccess,
        onKeepOpenSuccess: () => form.reset(),
      })

      return false
    },
  })

  useCheckFormErrors(form)

  const currentType = useStore(form.store, (s) => s.values.type)

  return (
    <form.AppForm>
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
                {DEPOSIT_UI_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSFER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          <DescriptionField form={form} placeholder="Opis wpłaty" />

          {/* Amount + Date */}
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <AmountField form={form} />
            </div>
            <div className="w-40">
              <DateField form={form} />
            </div>
          </div>

          {/* Payment method — temporarily hidden, always CASH */}
          {/* <PaymentMethodField form={form} /> */}

          <CashRegisterField form={form} cashRegisters={referenceData.cashRegisters} />

          {/* Conditional: Investment — for INVESTOR_DEPOSIT */}
          {requiresInvestment(currentType) && (
            <InvestmentField form={form} investments={referenceData.investments} />
          )}
        </FieldGroup>

        <div className="mt-6">
          <FormFooter />
        </div>
      </form>
    </form.AppForm>
  )
}
