'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { toastMessage } from '@/components/toasts'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import {
  DEPOSIT_UI_TYPES,
  TRANSFER_TYPE_LABELS,
  requiresInvestment,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import {
  transferFormSchema,
  type CreateTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister } from '@/lib/utils/default-cash-register'
import { today } from '@/lib/date-utils'
import {
  AmountField,
  CashRegisterField,
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

export function DepositForm({ referenceData, onSuccess, keepOpen }: DepositFormPropsT) {
  const FORM_ID = 'deposit'
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clearSubmission)

  const recovering = submission?.formId === FORM_ID && submission.status === 'failed'
  const recoveredValues = recovering ? (submission.formValues as FormValuesT) : undefined

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
      if (recovering) clearSubmission()

      const data: CreateTransferFormT = {
        description: value.description,
        amount: Number(value.amount),
        date: value.date,
        type: value.type as CreateTransferFormT['type'],
        paymentMethod: value.paymentMethod as PaymentMethodT,
        sourceRegister: Number(value.sourceRegister),
        investment: value.investment ? Number(value.investment) : undefined,
      }

      if (keepOpen) {
        const result = await createTransferAction(data, null)
        if (result.success) {
          toastMessage('Wpłata dodana', 'success')
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
          'Wpłata dodana',
        )
        onSuccess()
      }

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
          {/* Type — 3 deposit types */}
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

          <AmountField form={form} />

          {/* <DateField form={form} /> */}

          {/* Payment method — temporarily hidden, always CASH */}
          {/* <PaymentMethodField form={form} /> */}

          {/* Cash register no filtering in case of deposit */}
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
