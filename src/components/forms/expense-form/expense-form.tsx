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
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  needsTargetRegister,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import { uploadFilesClient } from '@/lib/upload-file-client'
import { getRegisterSaldo } from '@/lib/queries/register-saldo'
import {
  bulkExpenseFormSchema,
  type CreateBulkExpenseFormT,
} from '@/components/forms/expense-form/expense-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { today } from '@/lib/date-utils'
import {
  CashRegisterField,
  DateField,
  InvestmentField,
  LineItemsField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { SaldoSummary } from '../form-components/saldo-summary'
import { SaldoDisplay } from '@/components/ui/saldo-display'

type TransferFormPropsT = {
  referenceData: ReferenceDataT
  onSubmitSuccess: () => void
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

export function ExpenseForm({ referenceData, onSubmitSuccess, keepOpen }: TransferFormPropsT) {
  const { recoveredValues, recoveredFiles, submit } = useFormSubmit<FormValuesT>(FORM_ID)

  const { handleRemoveLineItem, handleFileChange, getFiles } = useInvoiceFiles(recoveredFiles)

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
        // sourceRegister: getDefaultCashRegister(referenceData),
        sourceRegister: '',
        targetRegister: '',
        investment: '',
        lineItems: [
          {
            description: '',
            amount: '',
            invoiceNote: '',
            category: '',
            expenseCategory: '',
          },
        ],
      } as FormValuesT),
    validators: {
      onSubmit: bulkExpenseFormSchema,
    },
    onSubmit: async ({ value }) => {
      const type = value.type as TransferTypeT
      const data: CreateBulkExpenseFormT = {
        date: value.date,
        type,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        sourceRegister: value.sourceRegister ? Number(value.sourceRegister) : undefined,
        targetRegister: value.targetRegister ? Number(value.targetRegister) : undefined,
        investment: value.investment ? Number(value.investment) : undefined,
        lineItems: value.lineItems.map((item) => ({
          description: item.description,
          amount: Number(item.amount),
          invoiceNote: item.invoiceNote || undefined,
          category: item.category ? Number(item.category) : undefined,
          expenseCategory:
            type === 'INVESTMENT_EXPENSE' && item.expenseCategory
              ? Number(item.expenseCategory)
              : undefined,
        })),
      }

      const files = getFiles()

      await submit(!!keepOpen, {
        action: async () => {
          let invoiceMediaIds: (number | undefined)[] | undefined
          if (files.size > 0) {
            try {
              invoiceMediaIds = await uploadFilesClient(files, value.lineItems.length)
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Nie udało się przesłać plików'
              return { success: false, error: message }
            }
          }
          return createBulkTransferAction(data, invoiceMediaIds)
        },
        successMessage: 'Transakcje dodane',
        formValues: value as unknown as Record<string, unknown>,
        files,
        onSubmitSuccess,
        onKeepOpenSuccess: () => form.reset(),
      })

      return false
    },
  })

  useCheckFormErrors(form)

  const currentType = useStore(form.store, (s) => s.values.type)
  const currentInvestment = useStore(form.store, (s) => s.values.investment)
  const lineItems = useStore(form.store, (s) => s.values.lineItems)
  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  // TanStack Form preserves values of unmounted fields. When the user switches
  // transfer type, hidden fields (e.g. investment) keep stale selections.
  // Reset them so validation and submission use a clean slate for the new type.
  const conditionalFields = ['targetRegister', 'investment'] as const

  function resetConditionalFields() {
    conditionalFields.forEach((field) => form.resetField(field))
    form.resetField('sourceRegister')
    form.resetField('lineItems')
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
          <div className="flex items-start gap-4">
            <form.AppField name="type" listeners={{ onChange: resetConditionalFields }}>
              {(field) => (
                <field.Select label="Typ wydatku" showError fieldClassName="min-w-0 flex-1">
                  {TRANSACTION_TRANSFER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRANSFER_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>
            <DateField form={form} fieldClassName="w-40" />
          </div>

          {showsInvestment(currentType) && (
            <InvestmentField form={form} investments={referenceData.investments} />
          )}

          {needsSourceRegister(currentType) && (
            <>
              <CashRegisterField
                form={form}
                cashRegisters={referenceData.cashRegisters}
                listeners={{ onChange: ({ value }: { value: string }) => fetchSaldo(value) }}
              />
              {isSaldoLoading && (
                <p className="text-muted-foreground text-sm">Ładowanie salda...</p>
              )}
              {saldo !== null && !isSaldoLoading && (
                <SaldoDisplay saldo={saldo} label="Aktualne saldo" />
              )}
            </>
          )}

          {needsTargetRegister(currentType) && (
            <CashRegisterField
              form={form}
              name="targetRegister"
              label="Kasa docelowa"
              placeholder="Wybierz kasę docelową"
              cashRegisters={referenceData.cashRegisters}
            />
          )}

          {!isDepositType(currentType) && (
            <LineItemsField
              form={form}
              total={total}
              hasInvestment={!!currentInvestment}
              onRemoveItem={handleRemoveLineItem}
              onFileChange={handleFileChange}
              transferType={currentType}
              referenceData={referenceData}
            />
          )}
        </FieldGroup>

        {saldo !== null && <SaldoSummary saldo={saldo} total={total} />}

        <FormFooter className="mt-6" />
      </form>
    </form.AppForm>
  )
}
