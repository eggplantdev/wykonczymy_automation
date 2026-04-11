'use client'

import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { useSaldo } from '@/components/forms/hooks/use-saldo'
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
  SourceRegisterField,
  // PaymentMethodField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormClearButton } from '../form-components/form-clear-button'
import { SaldoSummary } from '../form-components/saldo-summary'
import { useInternalTransferFormStore } from '@/stores/form-stores'

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
  const { submit } = useFormSubmit(FORM_ID)

  const storedValues = useInternalTransferFormStore((s) => s.formData)
  const updateFormData = useInternalTransferFormStore((s) => s.updateFormData)
  const resetFormData = useInternalTransferFormStore((s) => s.resetFormData)

  const { saldo, isSaldoLoading, fetchSaldo, resetSaldo } = useSaldo()

  function handleReset() {
    resetFormData()
    resetSaldo()
  }

  const form = useAppForm({
    defaultValues:
      storedValues ??
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
    listeners: {
      onChange: ({ formApi }) => updateFormData(formApi.state.values as FormValuesT),
      onChangeDebounceMs: 500,
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
        form,
        action: () => createTransferAction(data),
        successMessage: 'Transfer między kasami dodany',
        onSubmitSuccess,
        onReset: handleReset,
      })

      return false
    },
  })

  useCheckFormErrors(form)

  const currentAmount = useStore(form.store, (s) => Number(s.values.amount) || 0)

  return (
    <form.AppForm>
      <FormClearButton onReset={handleReset} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          <SourceRegisterField
            form={form}
            label="Kasa źródłowa"
            cashRegisters={referenceData.cashRegisters}
            saldo={saldo}
            isSaldoLoading={isSaldoLoading}
            fetchSaldo={fetchSaldo}
          />

          <CashRegisterField
            form={form}
            name="targetRegister"
            label="Kasa docelowa"
            placeholder="Wybierz kasę docelową"
            cashRegisters={referenceData.cashRegisters}
          />

          <div className="flex items-start gap-4">
            <AmountField form={form} fieldClassName="min-w-0 flex-1" />
            <DateField form={form} fieldClassName="w-40" />
          </div>

          {/* Payment method — temporarily hidden, always CASH */}
          {/* <PaymentMethodField form={form} /> */}

          <DescriptionField form={form} />
        </FieldGroup>

        {saldo !== null && (
          <SaldoSummary saldo={saldo} total={currentAmount} totalLabel="Kwota transferu" />
        )}

        <FormFooter className="mt-6" />
      </form>
    </form.AppForm>
  )
}
