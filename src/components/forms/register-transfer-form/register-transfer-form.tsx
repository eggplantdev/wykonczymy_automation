'use client'

import { FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastMessage } from '@/components/toasts'
import { type PaymentMethodT } from '@/lib/constants/transfers'
import { createTransferAction } from '@/lib/actions/transfers'
import { registerTransferFormSchema } from '@/components/forms/register-transfer-form/register-transfer-schema'
import type { CreateTransferFormT } from '@/components/forms/transfer-form/transfer-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { today } from '@/lib/date-utils'
import {
  AmountField,
  CashRegisterField,
  DateField,
  DescriptionField,
  PaymentMethodField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'

type RegisterTransferFormPropsT = {
  referenceData: ReferenceDataT
  userCashRegisterIds?: number[]
  onSuccess: () => void
}

type FormValuesT = {
  description: string
  amount: string
  date: string
  paymentMethod: string
  cashRegister: string
  targetRegister: string
}

export function RegisterTransferForm({
  referenceData,
  userCashRegisterIds,
  onSuccess,
}: RegisterTransferFormPropsT) {
  const form = useAppForm({
    defaultValues: {
      description: '',
      amount: '',
      date: today(),
      paymentMethod: 'CASH',
      cashRegister: userCashRegisterIds?.length === 1 ? String(userCashRegisterIds[0]) : '',
      targetRegister: '',
    } as FormValuesT,
    validators: {
      onSubmit: registerTransferFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: CreateTransferFormT = {
        description: value.description,
        amount: Number(value.amount),
        date: value.date,
        type: 'REGISTER_TRANSFER',
        paymentMethod: value.paymentMethod as PaymentMethodT,
        cashRegister: Number(value.cashRegister),
        targetRegister: Number(value.targetRegister),
      }

      const result = await createTransferAction(data, null)

      if (result.success) {
        toastMessage('Transfer między kasami dodany', 'success')
        onSuccess()
      } else {
        toastMessage(result.error, 'error')
      }

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
          {/* Source cash register — filtered to owned registers for non-ADMIN */}
          <CashRegisterField
            form={form}
            label="Kasa źródłowa"
            cashRegisters={referenceData.cashRegisters}
            userCashRegisterIds={userCashRegisterIds}
          />

          {/* Target cash register — all registers */}
          <CashRegisterField
            form={form}
            name="targetRegister"
            label="Kasa docelowa"
            placeholder="Wybierz kasę docelową"
            cashRegisters={referenceData.cashRegisters}
          />

          {/* Amount */}
          <AmountField form={form} />

          {/* Date */}
          <DateField form={form} />

          {/* Payment method */}
          <PaymentMethodField form={form} />

          {/* Description — optional */}
          <DescriptionField form={form} />
        </FieldGroup>

        <div className="mt-6">
          <FormFooter />
        </div>
      </form>
    </form.AppForm>
  )
}
