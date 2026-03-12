'use client'

import { FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { type PaymentMethodT } from '@/lib/constants/transfers'
import { createTransferAction } from '@/lib/actions/transfers'
import { internalTransferFormSchema } from '@/components/forms/internal-transfer-form/internal-transfer-schema'
import type { CreateTransferFormT } from '@/lib/schemas/transfer'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister } from '@/lib/utils/default-cash-register'
import { today } from '@/lib/date-utils'
import {
  AmountField,
  CashRegisterField,
  DateField,
  DescriptionField,
  // PaymentMethodField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'

type InternalTransferFormPropsT = {
  referenceData: ReferenceDataT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

type FormValuesT = {
  description: string
  amount: string
  date: string
  paymentMethod: string
  sourceRegister: string
  targetRegister: string
}

const FORM_ID = 'internal-transfer'

export function InternalTransferForm({
  referenceData,
  onSubmitSuccess,
  keepOpen,
}: InternalTransferFormPropsT) {
  const { isRecovering, recoveredValues, submit } = useFormSubmit<FormValuesT>(FORM_ID)

  const form = useAppForm({
    defaultValues:
      recoveredValues ??
      ({
        description: '',
        amount: '',
        date: today(),
        paymentMethod: 'CASH',
        sourceRegister: getDefaultCashRegister(referenceData),
        targetRegister: '',
      } as FormValuesT),
    validators: {
      onSubmit: internalTransferFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: CreateTransferFormT = {
        description: value.description,
        amount: Number(value.amount),
        date: value.date,
        type: 'REGISTER_TRANSFER',
        paymentMethod: value.paymentMethod as PaymentMethodT,
        sourceRegister: Number(value.sourceRegister),
        targetRegister: Number(value.targetRegister),
      }

      await submit(!!keepOpen, {
        action: () => createTransferAction(data, null),
        successMessage: 'Transfer między kasami dodany',
        formValues: value as unknown as Record<string, unknown>,
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
          {/* Source cash register */}
          <CashRegisterField
            form={form}
            label="Kasa źródłowa"
            cashRegisters={referenceData.cashRegisters}
          />

          {/* Target cash register — all registers */}
          <CashRegisterField
            form={form}
            name="targetRegister"
            label="Kasa docelowa"
            placeholder="Wybierz kasę docelową"
            cashRegisters={referenceData.cashRegisters}
          />

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
