'use client'

import { useRef, useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useInvoiceFiles } from '@/components/forms/hooks/use-invoice-files'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { toastMessage } from '@/components/toasts'
import {
  TRANSACTION_TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  EXPENSE_CATEGORY_LABEL,
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
} from '@/components/forms/expense-form/expense-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister } from '@/lib/utils/default-cash-register'
import { today } from '@/lib/date-utils'
import {
  CashRegisterField,
  DateField,
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
  lineItems: {
    description: string
    amount: string
    invoiceNote: string
    category: string
    expenseCategory: string
  }[]
}

const FORM_ID = 'expense'

export function ExpenseForm({ referenceData, onSuccess, keepOpen }: TransferFormPropsT) {
  const { isRecovering, recoveredValues, recoveredFiles, submit } =
    useFormSubmit<FormValuesT>(FORM_ID)

  const { handleRemoveLineItem, handleFileChange, buildInvoiceFormData, getFiles } =
    useInvoiceFiles(recoveredFiles)
  const defaultExpenseCategory = referenceData.expenseCategories[0]
    ? String(referenceData.expenseCategories[0].id)
    : ''

  const [saldo, setSaldo] = useState<number | null>(null)
  const [isSaldoLoading, setIsSaldoLoading] = useState(false)
  const saldoRequestRef = useRef(0)

  async function fetchSaldo(registerId: string) {
    setSaldo(null)
    if (!registerId) return

    const requestId = ++saldoRequestRef.current
    setIsSaldoLoading(true)
    try {
      const result = await getRegisterSaldo(Number(registerId))
      // Ignore stale responses from earlier selections
      if (saldoRequestRef.current === requestId) setSaldo(result.saldo)
    } catch {
      toastMessage('Nie udało się pobrać salda', 'error')
    } finally {
      if (saldoRequestRef.current === requestId) setIsSaldoLoading(false)
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
        lineItems: [
          {
            description: '',
            amount: '',
            invoiceNote: '',
            category: '',
            expenseCategory: defaultExpenseCategory,
          },
        ],
      } as FormValuesT),
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
        lineItems: value.lineItems.map((item) => ({
          description: item.description,
          amount: Number(item.amount),
          invoiceNote: item.invoiceNote || undefined,
          category: item.category ? Number(item.category) : undefined,
          expenseCategory: item.expenseCategory ? Number(item.expenseCategory) : undefined,
        })),
      }

      const invoiceFormData = buildInvoiceFormData()

      await submit(!!keepOpen, {
        action: () => createBulkTransferAction(data, invoiceFormData),
        successMessage: 'Transakcje dodane',
        formValues: value as unknown as Record<string, unknown>,
        files: getFiles(),
        onSuccess,
        onKeepOpenSuccess: () => form.reset(),
      })

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
  const conditionalFields = ['targetRegister', 'investment'] as const

  function resetConditionalFields() {
    conditionalFields.forEach((field) => form.resetField(field))
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
          {/* Type + Date */}
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
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
            </div>
            <div className="w-40">
              <DateField form={form} />
            </div>
          </div>

          {/* Conditional: Investment */}
          {showsInvestment(currentType) && (
            <InvestmentField form={form} investments={referenceData.investments} />
          )}

          {/* Cash register — filtered to owned registers for non-ADMIN */}
          {needsSourceRegister(currentType) && (
            <>
              <CashRegisterField
                form={form}
                cashRegisters={referenceData.cashRegisters}
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

          {/* Line items — all non-deposit types */}
          {!isDepositType(currentType) && (
            <LineItemsField
              form={form}
              emptyItem={{
                description: '',
                amount: '',
                invoiceNote: '',
                category: '',
                expenseCategory: defaultExpenseCategory,
              }}
              total={total}
              onRemoveItem={handleRemoveLineItem}
              onFileChange={handleFileChange}
              renderItemInline={(index) => {
                const cfg =
                  currentType === 'INVESTMENT_EXPENSE'
                    ? {
                        name: `lineItems[${index}].expenseCategory`,
                        label: EXPENSE_CATEGORY_LABEL,
                        placeholder: `${EXPENSE_CATEGORY_LABEL} *`,
                        options: referenceData.expenseCategories,
                      }
                    : currentType === 'OTHER'
                      ? {
                          name: `lineItems[${index}].category`,
                          label: 'Kategoria',
                          placeholder: 'Opcjonalnie',
                          options: referenceData.otherCategories,
                        }
                      : undefined

                if (!cfg) return null

                return (
                  <div className="min-w-0 flex-1">
                    <form.AppField name={cfg.name as never}>
                      {(field: {
                        Select: React.FC<{
                          placeholder: string
                          showError: boolean
                          children: React.ReactNode
                        }>
                      }) => (
                        <field.Select label={cfg.label} placeholder={cfg.placeholder} showError>
                          {cfg.options.map((cat) => (
                            <SelectItem key={cat.id} value={String(cat.id)}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </field.Select>
                      )}
                    </form.AppField>
                  </div>
                )
              }}
              renderItemSecondRow={(index) => {
                if (currentType !== 'INVESTMENT_EXPENSE') return null

                return (
                  <div className="min-w-0 flex-1">
                    <form.AppField name={`lineItems[${index}].category` as never}>
                      {(field: {
                        Select: React.FC<{
                          placeholder: string
                          showError: boolean
                          children: React.ReactNode
                        }>
                      }) => (
                        <field.Select label="Kategoria" placeholder="Opcjonalnie" showError>
                          {referenceData.otherCategories.map((cat) => (
                            <SelectItem key={cat.id} value={String(cat.id)}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </field.Select>
                      )}
                    </form.AppField>
                  </div>
                )
              }}
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
