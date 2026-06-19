'use client'

import { useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useInvoiceFiles } from '@/components/forms/hooks/use-invoice-files'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { useSaldo } from '@/components/forms/hooks/use-saldo'
import {
  TRANSACTION_TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  needsTargetRegister,
  needsWorker,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import { mapLineItem } from '@/components/forms/expense-form/map-line-item'
import { uploadFilesClient } from '@/lib/upload-file-client'
import {
  bulkExpenseFormSchema,
  type CreateBulkExpenseFormT,
} from '@/components/forms/expense-form/expense-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { today } from '@/lib/date-utils'
import {
  CashRegisterField,
  DateField,
  EntityComboboxField,
  SourceRegisterField,
  LineItemsField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormClearButton } from '../form-components/form-clear-button'
import { SaldoSummary } from '../form-components/saldo-summary'
import { useExpenseFormStore } from '@/stores/form-stores'

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
  worker: string
  settled: boolean
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
  const { recoveredFiles, submit } = useFormSubmit(FORM_ID)

  const storedValues = useExpenseFormStore((s) => s.formData)
  const updateFormData = useExpenseFormStore((s) => s.updateFormData)
  const resetFormData = useExpenseFormStore((s) => s.resetFormData)

  const { saldo, isSaldoLoading, fetchSaldo, resetSaldo } = useSaldo()

  // Bumped on reset to remount the (uncontrolled) file inputs, clearing their
  // native files and internal filename state — form.reset() can't reach them.
  const [fileInputKey, setFileInputKey] = useState(0)

  const {
    handleRemoveLineItem,
    handleFileChange,
    getFiles,
    reset: resetInvoiceFiles,
  } = useInvoiceFiles(recoveredFiles)

  function handleReset() {
    resetFormData()
    resetSaldo()
    resetInvoiceFiles()
    setFileInputKey((k) => k + 1)
  }

  const form = useAppForm({
    defaultValues:
      storedValues ??
      ({
        date: today(),
        type: 'INVESTMENT_EXPENSE',
        paymentMethod: 'CASH',
        sourceRegister: '',
        targetRegister: '',
        investment: '',
        worker: '',
        settled: false,
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
    listeners: {
      onChange: ({ formApi }) => updateFormData(formApi.state.values as FormValuesT),
      onChangeDebounceMs: 500,
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
        worker: value.worker ? Number(value.worker) : undefined,
        settled: value.settled,
        lineItems: value.lineItems.map((item) => mapLineItem(item, type, !!value.investment)),
      }

      const files = getFiles()

      await submit(!!keepOpen, {
        form,
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
        files,
        onSubmitSuccess,
        onReset: handleReset,
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
  const conditionalFields = ['targetRegister', 'investment', 'worker', 'settled'] as const

  function resetConditionalFields() {
    conditionalFields.forEach((field) => form.resetField(field))
    form.resetField('sourceRegister')
    form.resetField('lineItems')
    // resetField('lineItems') drops the line-item rows, but the queued files live
    // outside the form (invoiceFilesRef + uncontrolled inputs). Clear them too and
    // bump the key to remount the inputs — otherwise a file queued before the type
    // switch attaches to the wrong/nonexistent line item on submit.
    resetInvoiceFiles()
    setFileInputKey((k) => k + 1)
    resetSaldo()
  }

  return (
    <form.AppForm>
      <FormClearButton onReset={handleReset} />
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
            <EntityComboboxField
              form={form}
              variant="investment"
              items={referenceData.investments}
            />
          )}

          {(currentType === 'INVESTMENT_EXPENSE' || currentType === 'CORRECTION') && (
            <form.AppField name="settled">
              {(field) => (
                <field.Checkbox label="Wliczone w robociznę (materiał w cenie robocizny — nie obciąża klienta)" />
              )}
            </form.AppField>
          )}

          {needsSourceRegister(currentType) && (
            <SourceRegisterField
              form={form}
              cashRegisters={referenceData.cashRegisters}
              saldo={saldo}
              isSaldoLoading={isSaldoLoading}
              fetchSaldo={fetchSaldo}
            />
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

          {needsWorker(currentType) && (
            <EntityComboboxField form={form} variant="worker" items={referenceData.workers} />
          )}

          {!isDepositType(currentType) && (
            <LineItemsField
              form={form}
              total={total}
              hasInvestment={!!currentInvestment}
              onRemoveItem={handleRemoveLineItem}
              onFileChange={handleFileChange}
              fileInputKey={fileInputKey}
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
