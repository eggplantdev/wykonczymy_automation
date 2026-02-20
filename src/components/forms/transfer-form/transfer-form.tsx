'use client'

import { useMemo, useRef, useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FileInput } from '@/components/ui/file-input'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { toastMessage } from '@/components/toasts'
import {
  TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  isDepositType,
  needsCashRegister,
  showsInvestment,
  needsWorker,
  needsTargetRegister,
  needsOtherCategory,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createTransferAction } from '@/lib/actions/transfers'
import {
  transferFormSchema,
  type CreateTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import type { ReferenceDataT } from '@/components/dialogs/add-transfer-dialog'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'

type TransferFormPropsT = {
  referenceData: ReferenceDataT
  userCashRegisterIds?: number[]
  onSuccess: () => void
}

// Form state uses strings since HTML inputs/selects work with strings.
// Numeric conversion happens in the server action.
type FormValuesT = {
  description: string
  amount: string
  date: string
  type: string
  paymentMethod: string
  cashRegister: string
  targetRegister: string
  investment: string
  worker: string
  otherCategory: string
  otherDescription: string
  invoiceNote: string
}

const today = () => new Date().toISOString().split('T')[0]

export function TransferForm({
  referenceData,
  userCashRegisterIds,
  onSuccess,
}: TransferFormPropsT) {
  const invoiceRef = useRef<HTMLInputElement>(null)
  const isSourceRestricted = userCashRegisterIds !== undefined
  const ownedRegisterSet = useMemo(
    () => (userCashRegisterIds ? new Set(userCashRegisterIds) : undefined),
    [userCashRegisterIds],
  )
  const [expenseTarget, setExpenseTarget] = useState<'investment' | 'other'>('investment')

  const form = useAppForm({
    defaultValues: {
      description: '',
      amount: '',
      date: today(),
      type: 'INVESTMENT_EXPENSE',
      paymentMethod: 'CASH',
      cashRegister: userCashRegisterIds?.length === 1 ? String(userCashRegisterIds[0]) : '',
      targetRegister: '',
      investment: '',
      worker: '',
      otherCategory: '',
      otherDescription: '',
      invoiceNote: '',
    } as FormValuesT,
    validators: {
      onSubmit: transferFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: CreateTransferFormT = {
        description: value.description,
        amount: Number(value.amount),
        date: value.date,
        type: value.type as TransferTypeT,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        cashRegister: value.cashRegister ? Number(value.cashRegister) : undefined,
        targetRegister: value.targetRegister ? Number(value.targetRegister) : undefined,
        investment: value.investment ? Number(value.investment) : undefined,
        worker: value.worker ? Number(value.worker) : undefined,
        otherCategory: value.otherCategory ? Number(value.otherCategory) : undefined,
        otherDescription: value.otherDescription || undefined,
        invoiceNote: value.invoiceNote || undefined,
      }

      const file = invoiceRef.current?.files?.[0]
      let invoiceFormData: FormData | null = null
      if (file) {
        invoiceFormData = new FormData()
        invoiceFormData.set('invoice', file)
      }

      const result = await createTransferAction(data, invoiceFormData)

      if (result.success) {
        toastMessage('Transfer dodany', 'success')
        onSuccess()
      } else {
        console.log('result', result.error)
        toastMessage(result.error, 'error')
      }

      return false
    },
  })

  useCheckFormErrors(form)

  const currentType = useStore(form.store, (s) => s.values.type)

  // TanStack Form preserves values of unmounted fields. When the user switches
  // transfer type, hidden fields (e.g. investment, worker) keep stale selections.
  // Reset them so validation and submission use a clean slate for the new type.
  const conditionalFields = [
    'targetRegister',
    'investment',
    'worker',
    'otherCategory',
    'otherDescription',
  ] as const

  function resetConditionalFields() {
    conditionalFields.forEach((field) => form.resetField(field))
    if (!isSourceRestricted || (userCashRegisterIds && userCashRegisterIds.length > 1))
      form.resetField('cashRegister')
    setExpenseTarget('investment')
  }

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          {/* Type — OTHER_DEPOSIT hidden (use COMPANY_FUNDING or OTHER instead) */}
          <form.AppField name="type" listeners={{ onChange: resetConditionalFields }}>
            {(field) => (
              <field.Select label="Typ transferu" showError>
                {TRANSFER_TYPES.filter((t) => t !== 'OTHER_DEPOSIT').map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSFER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          {/* Radio toggle for EMPLOYEE_EXPENSE: investment vs other category */}
          {currentType === 'EMPLOYEE_EXPENSE' && (
            <fieldset className="space-y-2">
              <legend className="text-foreground text-sm font-medium">Cel wydatku</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="expenseTarget"
                    value="investment"
                    checked={expenseTarget === 'investment'}
                    onChange={() => {
                      setExpenseTarget('investment')
                      form.resetField('otherCategory')
                      form.resetField('otherDescription')
                    }}
                    className="accent-primary size-4"
                  />
                  Inwestycja
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="expenseTarget"
                    value="other"
                    checked={expenseTarget === 'other'}
                    onChange={() => {
                      setExpenseTarget('other')
                      form.resetField('investment')
                    }}
                    className="accent-primary size-4"
                  />
                  Inna kategoria
                </label>
              </div>
            </fieldset>
          )}

          {/* Conditional: Other category — always for OTHER, radio-gated for EMPLOYEE_EXPENSE */}
          {needsOtherCategory(currentType) &&
            (currentType === 'OTHER' || expenseTarget === 'other') && (
              <>
                <form.AppField name="otherCategory">
                  {(field) => (
                    <field.Select label="Kategoria" placeholder="Wybierz kategorię" showError>
                      {referenceData.otherCategories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </field.Select>
                  )}
                </form.AppField>

                <form.AppField name="otherDescription">
                  {(field) => (
                    <field.Textarea label="Opis kategorii" placeholder="Dodatkowy opis" showError />
                  )}
                </form.AppField>
              </>
            )}

          {/* Description — optional for all types */}
          <form.AppField name="description">
            {(field) => (
              <field.Input label="Opis (opcjonalnie)" placeholder="Opis transferu" showError />
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

          {/* Cash register — hidden for EMPLOYEE_EXPENSE, filtered to owned registers for non-ADMIN */}
          {needsCashRegister(currentType) && (
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
          )}

          {/* Conditional: Target register (REGISTER_TRANSFER only) */}
          {needsTargetRegister(currentType) && (
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
          )}

          {/* Conditional: Investment — radio-gated for EMPLOYEE_EXPENSE */}
          {showsInvestment(currentType) &&
            (currentType !== 'EMPLOYEE_EXPENSE' || expenseTarget === 'investment') && (
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

          {/* Conditional: Worker */}
          {needsWorker(currentType) && (
            <form.AppField name="worker">
              {(field) => (
                <field.Select label="Pracownik" placeholder="Wybierz pracownika" showError>
                  {referenceData.workers
                    .filter((w) => w.type !== 'ADMIN' && w.type !== 'OWNER')
                    .map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name}
                      </SelectItem>
                    ))}
                </field.Select>
              )}
            </form.AppField>
          )}

          {/* Invoice file — not bound to form state, read via ref on submit */}
          {!isDepositType(currentType) && currentType !== 'ACCOUNT_FUNDING' && (
            <div className="space-y-1">
              <label htmlFor="invoice" className="text-foreground text-sm font-medium">
                Faktura
              </label>
              <FileInput
                ref={invoiceRef}
                id="invoice"
                name="invoice"
                accept="image/*,application/pdf"
              />
            </div>
          )}

          {/* Invoice note */}
          {!isDepositType(currentType) && currentType !== 'ACCOUNT_FUNDING' && (
            <form.AppField name="invoiceNote">
              {(field) => (
                <field.Textarea
                  label="Notatka do faktury"
                  placeholder="Opcjonalna notatka do faktury"
                  showError
                />
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
