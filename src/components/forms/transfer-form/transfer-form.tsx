'use client'

import { useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useInvoiceFiles } from '@/components/forms/hooks/use-invoice-files'
import { toastMessage } from '@/components/toasts'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import {
  TRANSACTION_TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  needsTargetRegister,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createBulkTransferAction, getRegisterSaldo } from '@/lib/actions/transfers'
import { formatPLN } from '@/lib/format-currency'
import {
  bulkTransferFormSchema,
  type CreateBulkTransferFormT,
} from '@/components/forms/transfer-form/transfer-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister, getUserCashRegisterIds } from '@/lib/utils/default-cash-register'
import { today } from '@/lib/date-utils'
import {
  CashRegisterField,
  DateField,
  ExpenseCategoryField,
  InvestmentField,
  LineItemsField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'

type TransferFormPropsT = {
  referenceData: ReferenceDataT
  onSuccess: () => void
  keepOpen?: boolean
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
  expenseCategory: string
  lineItems: {
    description: string
    amount: string
    invoiceNote: string
    category: string
    note: string
  }[]
}

export function TransferForm({ referenceData, onSuccess, keepOpen }: TransferFormPropsT) {
  const FORM_ID = 'transfer'
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clearSubmission)

  const recovering = submission?.formId === FORM_ID && submission.status === 'failed'
  const recoveredValues = recovering ? (submission.formValues as FormValuesT) : undefined
  const recoveredFiles = recovering ? submission.invoiceFiles : undefined

  const { handleRemoveLineItem, handleFileChange, buildInvoiceFormData, getFiles } =
    useInvoiceFiles(recoveredFiles)
  const userCashRegisterIds = getUserCashRegisterIds(referenceData)
  const isSourceRestricted = userCashRegisterIds !== undefined

  const [saldo, setSaldo] = useState<number | null>(null)
  const [isSaldoLoading, setIsSaldoLoading] = useState(false)

  async function fetchSaldo(registerId: string) {
    setSaldo(null)
    if (!registerId) return

    setIsSaldoLoading(true)
    try {
      const result = await getRegisterSaldo(Number(registerId))
      setSaldo(result.saldo)
    } catch {
      toastMessage('Nie udało się pobrać salda', 'error')
    } finally {
      setIsSaldoLoading(false)
    }
  }

  const form = useAppForm({
    defaultValues:
      recoveredValues ??
      ({
        date: today(),
        type: 'INVESTMENT_EXPENSE',
        paymentMethod: 'CASH',
        sourceRegister: getDefaultCashRegister(referenceData),
        targetRegister: '',
        investment: '',
        expenseCategory: referenceData.expenseCategories[0]
          ? String(referenceData.expenseCategories[0].id)
          : '',
        lineItems: [{ description: '', amount: '', invoiceNote: '', category: '', note: '' }],
      } as FormValuesT),
    validators: {
      onSubmit: bulkTransferFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (recovering) clearSubmission()

      const data: CreateBulkTransferFormT = {
        date: value.date,
        type: value.type as TransferTypeT,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        sourceRegister: value.sourceRegister ? Number(value.sourceRegister) : undefined,
        targetRegister: value.targetRegister ? Number(value.targetRegister) : undefined,
        investment: value.investment ? Number(value.investment) : undefined,
        expenseCategory: value.expenseCategory ? Number(value.expenseCategory) : undefined,
        lineItems: value.lineItems.map((item) => ({
          description: item.description,
          amount: Number(item.amount),
          invoiceNote: item.invoiceNote || undefined,
          category: item.category ? Number(item.category) : undefined,
          note: item.note || undefined,
        })),
      }

      const invoiceFormData = buildInvoiceFormData()

      if (keepOpen) {
        const result = await createBulkTransferAction(data, invoiceFormData)
        if (result.success) {
          toastMessage('Transakcje dodane', 'success')
          form.reset()
        } else {
          toastMessage(result.error, 'error')
        }
      } else {
        submitOptimistically(
          FORM_ID,
          value as unknown as Record<string, unknown>,
          getFiles(),
          () => createBulkTransferAction(data, invoiceFormData),
          'Transakcje dodane',
        )
        onSuccess()
      }

      return false
    },
  })

  useCheckFormErrors(form)

  const currentType = useStore(form.store, (s) => s.values.type)
  const lineItems = useStore(form.store, (s) => s.values.lineItems)
  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  // TanStack Form preserves values of unmounted fields. When the user switches
  // transfer type, hidden fields (e.g. investment) keep stale selections.
  // Reset them so validation and submission use a clean slate for the new type.
  const conditionalFields = ['targetRegister', 'investment', 'expenseCategory'] as const

  function resetConditionalFields() {
    conditionalFields.forEach((field) => form.resetField(field))
    if (!isSourceRestricted || (userCashRegisterIds && userCashRegisterIds.length > 1))
      form.resetField('sourceRegister')
    setSaldo(null)
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
          {/* Date */}

          {/* Type — deposit types moved to separate deposit dialog */}
          <form.AppField name="type" listeners={{ onChange: resetConditionalFields }}>
            {(field) => (
              <field.Select label="Typ wydatku" showError>
                {TRANSACTION_TRANSFER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSFER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>
          <DateField form={form} />

          {/* Cash register — filtered to owned registers for non-ADMIN */}
          {needsSourceRegister(currentType) && (
            <>
              <CashRegisterField
                form={form}
                cashRegisters={referenceData.cashRegisters}
                userCashRegisterIds={userCashRegisterIds}
                listeners={{
                  onChange: ({ value }: { value: string }) => {
                    fetchSaldo(value)
                  },
                }}
              />
              {isSaldoLoading && (
                <p className="text-muted-foreground text-sm">Ładowanie salda...</p>
              )}
              {saldo !== null && !isSaldoLoading && (
                <p className="text-sm">
                  Aktualne saldo: <span className="font-medium">{formatPLN(saldo)}</span>
                </p>
              )}
            </>
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

          {/* Conditional: Investment */}
          {showsInvestment(currentType) && (
            <InvestmentField form={form} investments={referenceData.investments} />
          )}

          {/* Conditional: Expense category — for INVESTMENT_EXPENSE */}
          {currentType === 'INVESTMENT_EXPENSE' && (
            <ExpenseCategoryField form={form} expenseCategories={referenceData.expenseCategories} />
          )}

          {/* Line items — all non-deposit types */}
          {!isDepositType(currentType) && (
            <LineItemsField
              form={form}
              emptyItem={{ description: '', amount: '', invoiceNote: '', category: '', note: '' }}
              total={total}
              onRemoveItem={handleRemoveLineItem}
              onFileChange={handleFileChange}
              renderItemExtras={(index) => (
                <>
                  <div className="grid gap-2 md:grid-cols-2">
                    <form.AppField name={`lineItems[${index}].category`}>
                      {(field: {
                        Select: React.FC<{
                          label: string
                          placeholder: string
                          showError: boolean
                          children: React.ReactNode
                        }>
                      }) => (
                        <field.Select
                          label={currentType === 'OTHER' ? 'Kategoria *' : 'Kategoria'}
                          placeholder="Wybierz kategorię"
                          showError
                        >
                          {referenceData.otherCategories.map((cat) => (
                            <SelectItem key={cat.id} value={String(cat.id)}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </field.Select>
                      )}
                    </form.AppField>
                    <form.AppField name={`lineItems[${index}].note`}>
                      {(field: {
                        Input: React.FC<{
                          label: string
                          placeholder: string
                          showError: boolean
                        }>
                      }) => (
                        <field.Input label="Notatka" placeholder="Notatka do pozycji" showError />
                      )}
                    </form.AppField>
                  </div>
                  <form.AppField name={`lineItems[${index}].invoiceNote`}>
                    {(field: {
                      Textarea: React.FC<{
                        placeholder: string
                        showError: boolean
                        className: string
                      }>
                    }) => (
                      <field.Textarea
                        placeholder="Notatka do faktury (opcjonalnie)"
                        showError
                        className="min-h-6"
                      />
                    )}
                  </form.AppField>
                </>
              )}
            />
          )}
        </FieldGroup>

        {saldo !== null && (
          <div className="bg-muted/50 border-border mt-6 space-y-1 rounded-lg border px-6 py-4">
            <p className="text-sm">
              Aktualne saldo: <span className="font-medium">{formatPLN(saldo)}</span>
            </p>
            <p className="text-sm">
              Suma wydatków: <span className="font-medium">{formatPLN(total)}</span>
            </p>
            <p className="text-sm">
              Saldo po transakcji: <span className="font-medium">{formatPLN(saldo - total)}</span>
            </p>
          </div>
        )}

        <div className="mt-6">
          <FormFooter />
        </div>
      </form>
    </form.AppForm>
  )
}
