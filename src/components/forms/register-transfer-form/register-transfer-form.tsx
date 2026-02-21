'use client'

import { useMemo } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { toastMessage } from '@/components/toasts'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createTransferAction } from '@/lib/actions/transfers'
import { registerTransferFormSchema } from '@/components/forms/register-transfer-form/register-transfer-schema'
import type { CreateTransferFormT } from '@/components/forms/transfer-form/transfer-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { today } from '@/lib/date-utils'
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
  const ownedRegisterSet = useMemo(
    () => (userCashRegisterIds ? new Set(userCashRegisterIds) : undefined),
    [userCashRegisterIds],
  )

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
          <form.AppField name="cashRegister">
            {(field) => (
              <field.Select label="Kasa źródłowa" placeholder="Wybierz kasę" showError>
                {referenceData.cashRegisters
                  .filter((cr) => !ownedRegisterSet || ownedRegisterSet.has(cr.id))
                  .map((cr) => (
                    <SelectItem key={cr.id} value={String(cr.id)}>
                      {cr.name}
                    </SelectItem>
                  ))}
              </field.Select>
            )}
          </form.AppField>

          {/* Target cash register — all registers */}
          <form.AppField name="targetRegister">
            {(field) => (
              <field.Select label="Kasa docelowa" placeholder="Wybierz kasę docelową" showError>
                {referenceData.cashRegisters.map((cr) => (
                  <SelectItem key={cr.id} value={String(cr.id)}>
                    {cr.name}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          {/* Amount */}
          <form.AppField name="amount">
            {(field) => (
              <field.Input label="Kwota (PLN)" placeholder="0.00" type="number" showError />
            )}
          </form.AppField>

          {/* Date */}
          <form.AppField name="date">
            {(field) => <field.Input label="Data" type="date" showError />}
          </form.AppField>

          {/* Payment method */}
          <form.AppField name="paymentMethod">
            {(field) => (
              <field.Select label="Metoda płatności" showError>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          {/* Description — optional */}
          <form.AppField name="description">
            {(field) => (
              <field.Input label="Opis (opcjonalnie)" placeholder="Opis transferu" showError />
            )}
          </form.AppField>
        </FieldGroup>

        <div className="mt-6">
          <FormFooter />
        </div>
      </form>
    </form.AppForm>
  )
}
