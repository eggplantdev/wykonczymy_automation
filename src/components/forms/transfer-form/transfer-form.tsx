'use client'

import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectItem } from '@/components/ui/select'
import { FileInput } from '@/components/ui/file-input'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { toastMessage } from '@/components/toasts'
import { formatPLN } from '@/lib/format-currency'
import {
  TRANSACTION_TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  needsWorker,
  needsTargetRegister,
  needsOtherCategory,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import {
  bulkTransferFormSchema,
  type CreateBulkTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister, getUserCashRegisterIds } from '@/lib/utils/default-cash-register'
import { today } from '@/lib/date-utils'
import { CashRegisterField, InvestmentField, WorkerField } from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'

type TransferFormPropsT = {
  referenceData: ReferenceDataT
  onSuccess: () => void
}

// Form state uses strings since HTML inputs/selects work with strings.
// Numeric conversion happens in the server action.
type FormValuesT = {
  date: string
  type: string
  paymentMethod: string
  sourceRegister: string
  targetRegister: string
  investment: string
  worker: string
  otherCategory: string
  otherDescription: string
  lineItems: { description: string; amount: string; invoiceNote: string }[]
}

export function TransferForm({ referenceData, onSuccess }: TransferFormPropsT) {
  const invoiceFilesRef = useRef<Map<number, File>>(new Map())
  const userCashRegisterIds = getUserCashRegisterIds(referenceData)
  const isSourceRestricted = userCashRegisterIds !== undefined
  const [expenseTarget, setExpenseTarget] = useState<'investment' | 'other'>('investment')

  const form = useAppForm({
    defaultValues: {
      date: today(),
      type: 'INVESTMENT_EXPENSE',
      paymentMethod: 'CASH',
      sourceRegister: getDefaultCashRegister(referenceData),
      targetRegister: '',
      investment: '',
      worker: '',
      otherCategory: '',
      otherDescription: '',
      lineItems: [{ description: '', amount: '', invoiceNote: '' }],
    } as FormValuesT,
    validators: {
      onSubmit: bulkTransferFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: CreateBulkTransferFormT = {
        date: value.date,
        type: value.type as TransferTypeT,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        sourceRegister: value.sourceRegister ? Number(value.sourceRegister) : undefined,
        targetRegister: value.targetRegister ? Number(value.targetRegister) : undefined,
        investment: value.investment ? Number(value.investment) : undefined,
        worker: value.worker ? Number(value.worker) : undefined,
        otherCategory: value.otherCategory ? Number(value.otherCategory) : undefined,
        otherDescription: value.otherDescription || undefined,
        lineItems: value.lineItems.map((item) => ({
          description: item.description,
          amount: Number(item.amount),
          invoiceNote: item.invoiceNote || undefined,
        })),
      }

      let invoiceFormData: FormData | null = null
      if (invoiceFilesRef.current.size > 0) {
        invoiceFormData = new FormData()
        invoiceFilesRef.current.forEach((file, index) => {
          invoiceFormData!.set(`invoice-${index}`, file)
        })
      }

      const result = await createBulkTransferAction(data, invoiceFormData)

      if (result.success) {
        toastMessage('Transakcje dodane', 'success')
        onSuccess()
      } else {
        toastMessage(result.error, 'error')
      }

      return false
    },
  })

  useCheckFormErrors(form)

  const currentType = useStore(form.store, (s) => s.values.type)
  const lineItems = useStore(form.store, (s) => s.values.lineItems)
  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

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
      form.resetField('sourceRegister')
    setExpenseTarget('investment')
  }

  function handleRemoveLineItem(index: number, removeValue: (index: number) => void) {
    const oldFiles = invoiceFilesRef.current
    const newFiles = new Map<number, File>()
    oldFiles.forEach((file, i) => {
      if (i < index) newFiles.set(i, file)
      else if (i > index) newFiles.set(i - 1, file)
    })
    invoiceFilesRef.current = newFiles
    removeValue(index)
  }

  function handleFileChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) invoiceFilesRef.current.set(index, file)
    else invoiceFilesRef.current.delete(index)
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
          {/* Type — deposit types moved to separate deposit dialog */}
          <form.AppField name="type" listeners={{ onChange: resetConditionalFields }}>
            {(field) => (
              <field.Select label="Typ transferu" showError>
                {TRANSACTION_TRANSFER_TYPES.map((t) => (
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

          {/* Cash register — hidden for EMPLOYEE_EXPENSE, filtered to owned registers for non-ADMIN */}
          {needsSourceRegister(currentType) && (
            <CashRegisterField
              form={form}
              cashRegisters={referenceData.cashRegisters}
              userCashRegisterIds={userCashRegisterIds}
            />
          )}

          {/* Conditional: Target register (REGISTER_TRANSFER only) */}
          {needsTargetRegister(currentType) && (
            <CashRegisterField
              form={form}
              name="targetRegister"
              label="Kasa docelowa"
              placeholder="Wybierz kasę docelową"
              cashRegisters={referenceData.cashRegisters}
            />
          )}

          {/* Conditional: Investment — radio-gated for EMPLOYEE_EXPENSE */}
          {showsInvestment(currentType) &&
            (currentType !== 'EMPLOYEE_EXPENSE' || expenseTarget === 'investment') && (
              <InvestmentField form={form} investments={referenceData.investments} />
            )}

          {/* Conditional: Worker */}
          {needsWorker(currentType) && <WorkerField form={form} workers={referenceData.workers} />}

          {/* Line items */}
          {!isDepositType(currentType) && (
            <form.Field name="lineItems" mode="array">
              {(lineItemsField) => (
                <div className="space-y-4">
                  <p className="text-foreground text-sm font-medium">Pozycje</p>
                  {lineItemsField.state.value.map((_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <form.AppField name={`lineItems[${index}].description`}>
                            {(field) => <field.Input placeholder="Opis pozycji" showError />}
                          </form.AppField>
                        </div>
                        <div className="w-36">
                          <form.AppField name={`lineItems[${index}].amount`}>
                            {(field) => <field.Input placeholder="Kwota" type="number" showError />}
                          </form.AppField>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLineItem(index, lineItemsField.removeValue)}
                          disabled={lineItemsField.state.value.length === 1}
                          aria-label="Usuń pozycję"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      {currentType !== 'ACCOUNT_FUNDING' && (
                        <>
                          <FileInput
                            accept="image/*,application/pdf"
                            onChange={(e) => handleFileChange(index, e)}
                          />
                          <form.AppField name={`lineItems[${index}].invoiceNote`}>
                            {(field) => (
                              <field.Textarea
                                placeholder="Notatka do faktury (opcjonalnie)"
                                showError
                                className="min-h-6"
                              />
                            )}
                          </form.AppField>
                        </>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      lineItemsField.pushValue({
                        description: '',
                        amount: '',
                        invoiceNote: '',
                      })
                    }
                  >
                    Dodaj pozycję
                  </Button>
                  <p className="text-foreground text-sm font-medium">Suma: {formatPLN(total)}</p>
                </div>
              )}
            </form.Field>
          )}
        </FieldGroup>

        <div className="mt-6">
          <FormFooter />
        </div>
      </form>
    </form.AppForm>
  )
}
