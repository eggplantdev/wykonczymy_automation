'use client'

import { FieldGroup } from '@/components/ui/field'
import { useStore } from '@/components/forms/hooks/form-hooks'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
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
} from '@/components/forms/form-fields'
import FormFooter from '../form-components/form-footer'
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
  const { saldo, isSaldoLoading, fetchSaldo, resetSaldo } = useSaldo()

  const { form, reset } = useManagedForm<FormValuesT, CreateTransferFormT>({
    formId: FORM_ID,
    store: useInternalTransferFormStore,
    schema: internalTransferFormSchema,
    defaultValues: {
      description: '',
      amount: '',
      date: today(),
      paymentMethod: 'CASH',
      sourceRegister: getDefaultCashRegister(referenceData),
      targetRegister: '',
    },
    keepOpen,
    successMessage: 'Transfer między kasami dodany',
    onSubmitSuccess,
    action: createTransferAction,
    onReset: resetSaldo,
    toData: (value) => ({
      description: value.description,
      amount: Number(value.amount),
      date: value.date,
      type: 'REGISTER_TRANSFER',
      paymentMethod: value.paymentMethod as PaymentMethodT,
      sourceRegister: Number(value.sourceRegister),
      targetRegister: Number(value.targetRegister),
    }),
  })

  const currentAmount = useStore(form.store, (s) => Number(s.values.amount) || 0)

  return (
    <FormShell form={form} onReset={reset}>
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

        <DescriptionField form={form} />
      </FieldGroup>

      {saldo !== null && (
        <SaldoSummary saldo={saldo} total={currentAmount} totalLabel="Kwota transferu" />
      )}

      <FormFooter className="mt-6" />
    </FormShell>
  )
}
