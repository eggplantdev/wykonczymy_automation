'use client'

import { FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastMessage } from '@/components/toasts'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { type PaymentMethodT } from '@/lib/constants/transfers'
import { createTransferAction } from '@/lib/actions/transfers'
import { registerTransferFormSchema } from '@/components/forms/register-transfer-form/register-transfer-schema'
import type { CreateTransferFormT } from '@/components/forms/transfer-form/transfer-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister, getUserCashRegisterIds } from '@/lib/utils/default-cash-register'
import { today } from '@/lib/date-utils'
import {
  AmountField,
  CashRegisterField,
  DescriptionField,
  // PaymentMethodField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'

type RegisterTransferFormPropsT = {
  referenceData: ReferenceDataT
  onSuccess: () => void
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

const FORM_ID = 'register-transfer'

export function RegisterTransferForm({
  referenceData,
  onSuccess,
  keepOpen,
}: RegisterTransferFormPropsT) {
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clearSubmission)

  const recovering = submission?.formId === FORM_ID && submission.status === 'failed'
  const recoveredValues = recovering ? (submission.formValues as FormValuesT) : undefined

  const userCashRegisterIds = getUserCashRegisterIds(referenceData)
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
      onSubmit: registerTransferFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (recovering) clearSubmission()

      const data: CreateTransferFormT = {
        description: value.description,
        amount: Number(value.amount),
        date: value.date,
        type: 'REGISTER_TRANSFER',
        paymentMethod: value.paymentMethod as PaymentMethodT,
        sourceRegister: Number(value.sourceRegister),
        targetRegister: Number(value.targetRegister),
      }

      if (keepOpen) {
        const result = await createTransferAction(data, null)
        if (result.success) {
          toastMessage('Transfer między kasami dodany', 'success')
          form.reset()
        } else {
          toastMessage(result.error, 'error')
        }
      } else {
        submitOptimistically(
          FORM_ID,
          value as unknown as Record<string, unknown>,
          new Map(),
          () => createTransferAction(data, null),
          'Transfer między kasami dodany',
        )
        onSuccess()
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
          {/* <DateField form={form} /> */}

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
