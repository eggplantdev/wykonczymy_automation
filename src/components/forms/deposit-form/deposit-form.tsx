'use client'

import { useMemo } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { toastMessage } from '@/components/toasts'
import {
  DEPOSIT_UI_TYPES,
  TRANSFER_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  requiresInvestment,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createTransferAction } from '@/lib/actions/transfers'
import { depositFormSchema } from '@/components/forms/deposit-form/deposit-schema'
import type { CreateTransferFormT } from '@/components/forms/transfer-form/transfer-schema'
import type { ReferenceDataT } from '@/components/dialogs/add-transfer-dialog'
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

const today = () => new Date().toISOString().split('T')[0]

export function DepositForm({ referenceData, userCashRegisterIds, onSuccess }: DepositFormPropsT) {
  const ownedRegisterSet = useMemo(
    () => (userCashRegisterIds ? new Set(userCashRegisterIds) : undefined),
    [userCashRegisterIds],
  )

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
          <form.AppField name="description">
            {(field) => (
              <field.Input label="Opis (opcjonalnie)" placeholder="Opis wpłaty" showError />
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

          {/* Cash register — filtered to owned registers for non-ADMIN */}
          <form.AppField name="cashRegister">
            {(field) => (
              <field.Select label="Kasa" placeholder="Wybierz kasę" showError>
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
