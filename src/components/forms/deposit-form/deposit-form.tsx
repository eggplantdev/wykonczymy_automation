'use client'

import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { toastMessage } from '@/components/toasts'
import {
  DEPOSIT_UI_TYPES,
  TRANSFER_TYPE_LABELS,
  requiresInvestment,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createTransferAction } from '@/lib/actions/transfers'
import { depositFormSchema } from '@/components/forms/deposit-form/deposit-schema'
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

type DepositFormPropsT = {
  referenceData: ReferenceDataT
  userCashRegisterIds?: number[]
  onSuccess: () => void
}

type FormValuesT = {
  description: string
  amount: string
  date: string
  type: string
  paymentMethod: string
  cashRegister: string
  investment: string
}

export function DepositForm({ referenceData, userCashRegisterIds, onSuccess }: DepositFormPropsT) {
  const form = useAppForm({
    defaultValues: {
      description: '',
      amount: '',
      date: today(),
      type: 'INVESTOR_DEPOSIT',
      paymentMethod: 'CASH',
      cashRegister: userCashRegisterIds?.length === 1 ? String(userCashRegisterIds[0]) : '',
      investment: '',
    } as FormValuesT,
    validators: {
      onSubmit: depositFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: CreateTransferFormT = {
        description: value.description,
        amount: Number(value.amount),
        date: value.date,
        type: value.type as TransferTypeT,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        cashRegister: value.cashRegister ? Number(value.cashRegister) : undefined,
        investment: value.investment ? Number(value.investment) : undefined,
      }

      const result = await createTransferAction(data, null)

      if (result.success) {
        toastMessage('Wpłata dodana', 'success')
        onSuccess()
      } else {
        toastMessage(result.error, 'error')
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

          {/* Description — optional */}
          <DescriptionField form={form} placeholder="Opis wpłaty" />

          {/* Amount */}
          <AmountField form={form} />

          {/* Date */}
          <DateField form={form} />

          {/* Payment method */}
          <PaymentMethodField form={form} />

          {/* Cash register — filtered to owned registers for non-ADMIN */}
          <CashRegisterField
            form={form}
            cashRegisters={referenceData.cashRegisters}
            userCashRegisterIds={userCashRegisterIds}
          />

          {/* Conditional: Investment — for INVESTOR_DEPOSIT and STAGE_SETTLEMENT */}
          {requiresInvestment(currentType) && (
            <form.AppField name="investment">
              {(field) => (
                <field.Select label="Inwestycja" placeholder="Wybierz inwestycję" showError>
                  {referenceData.investments.map((inv) => (
                    <SelectItem key={inv.id} value={String(inv.id)}>
                      {inv.name}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>
          )}
        </FieldGroup>

        <div className="mt-6">
          <FormFooter />
        </div>
      </form>
    </form.AppForm>
  )
}
