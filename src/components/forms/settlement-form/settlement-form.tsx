'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FieldGroup } from '@/components/ui/field'
import { SelectItem } from '@/components/ui/select'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useInvoiceFiles } from '@/components/forms/hooks/use-invoice-files'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import FormFooter from '@/components/forms/form-components/form-footer'
import { toastMessage } from '@/components/toasts'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { formatPLN } from '@/lib/format-currency'
import { type PaymentMethodT } from '@/lib/constants/transfers'
import { createSettlementAction, getManagementEmployeeSaldo } from '@/lib/actions/settlements'
import { cn } from '@/lib/cn'
import { today } from '@/lib/date-utils'
import {
  AmountField,
  CashRegisterField,
  DateField,
  DescriptionField,
  InvestmentField,
  LineItemsField,
  /* PaymentMethodField, */ WorkerField,
} from '@/components/forms/form-fields'
import { settlementFormSchema, type CreateSettlementFormT } from './settlement-schema'
import type { ReferenceItemT } from '@/types/reference-data'

type SettlementReferenceDataT = {
  users: ReferenceItemT[]
  investments: ReferenceItemT[]
  expenseCategories: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
  cashRegisters: ReferenceItemT[]
  defaultCashRegisterId?: number
}

type SettlementFormPropsT = {
  referenceData: SettlementReferenceDataT
  className?: string
  onSuccess?: () => void
  keepOpen?: boolean
}

type FormValuesT = {
  worker: string
  mode: 'investment' | 'category' | 'register'
  investment?: string
  expenseCategory: string
  sourceRegister: string
  amount: string
  description: string
  date: string
  paymentMethod: string
  invoiceNote: string
  lineItems: { description: string; amount: string; category?: string; note?: string }[]
}

export function SettlementForm({
  referenceData,
  className,
  onSuccess,
  keepOpen,
}: SettlementFormPropsT) {
  const router = useRouter()

  const FORM_ID = 'settlement'
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clearSubmission)

  const recovering = submission?.formId === FORM_ID && submission.status === 'failed'
  const recoveredValues = recovering ? (submission.formValues as FormValuesT) : undefined
  const recoveredFiles = recovering ? submission.invoiceFiles : undefined

  const { handleRemoveLineItem, handleFileChange, buildInvoiceFormData, getFiles } =
    useInvoiceFiles(recoveredFiles)

  // Saldo is display-only, not form data
  const [saldo, setSaldo] = useState<number | null>(null)
  const [isSaldoLoading, setIsSaldoLoading] = useState(false)

  const form = useAppForm({
    defaultValues:
      recoveredValues ??
      ({
        worker: '',
        mode: 'investment' as const,
        investment: '',
        expenseCategory: '',
        sourceRegister: referenceData.defaultCashRegisterId
          ? String(referenceData.defaultCashRegisterId)
          : '',
        amount: '',
        description: '',
        date: today(),
        paymentMethod: 'CASH',
        invoiceNote: '',
        lineItems: [{ description: '', amount: '', category: '', note: '' }],
      } as FormValuesT),
    validators: {
      onSubmit: settlementFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (recovering) clearSubmission()

      const data: CreateSettlementFormT = {
        worker: Number(value.worker),
        mode: value.mode,
        investment: value.mode === 'investment' ? Number(value.investment) : undefined,
        expenseCategory:
          value.mode === 'investment' && value.expenseCategory
            ? Number(value.expenseCategory)
            : undefined,
        sourceRegister: value.mode === 'register' ? Number(value.sourceRegister) : undefined,
        amount: value.mode === 'register' ? Number(value.amount) : undefined,
        description: value.mode === 'register' ? value.description || undefined : undefined,
        date: value.date,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        invoiceNote: value.invoiceNote || undefined,
        lineItems:
          value.mode === 'register'
            ? []
            : value.lineItems.map((item) => ({
                description: item.description,
                amount: Number(item.amount),
                category: value.mode === 'category' ? Number(item.category) : undefined,
                note: value.mode === 'category' ? item.note : undefined,
              })),
      }

      if (onSuccess && !keepOpen) {
        const invoiceFormData = buildInvoiceFormData()
        submitOptimistically(
          FORM_ID,
          value as unknown as Record<string, unknown>,
          getFiles(),
          () => createSettlementAction(data, invoiceFormData),
          'Dodano',
        )
        onSuccess()
      } else {
        const result = await createSettlementAction(data, buildInvoiceFormData())
        if (result.success) {
          toastMessage('Dodano', 'success')
          if (keepOpen) form.reset()
          else if (onSuccess) onSuccess()
          else router.push('/')
        } else {
          toastMessage(result.error, 'error')
        }
      }

      return false
    },
  })

  useCheckFormErrors(form)

  const lineItems = useStore(form.store, (s) => s.values.lineItems)
  const mode = useStore(form.store, (s) => s.values.mode)
  const registerAmount = useStore(form.store, (s) => s.values.amount)
  const total =
    mode === 'register'
      ? Number(registerAmount) || 0
      : lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const submitLabel = mode === 'register' ? 'Zwrot do kasy' : `Rozlicz (${lineItems.length} pozycji`

  async function fetchSaldo(workerId: string) {
    setSaldo(null)
    if (!workerId) return

    setIsSaldoLoading(true)
    try {
      const result = await getManagementEmployeeSaldo(Number(workerId))
      setSaldo(result.saldo)
    } catch {
      toastMessage('Nie udało się pobrać salda', 'error')
    } finally {
      setIsSaldoLoading(false)
    }
  }

  return (
    <div className={cn('max-w-3xl', className)}>
      <form.AppForm>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <FieldGroup>
            {/* Employee selector */}
            <WorkerField
              form={form}
              workers={referenceData.users}
              filterByRole={false}
              listeners={{
                onChange: ({ value }: { value: string }) => {
                  fetchSaldo(value)
                },
              }}
            />

            <DateField form={form} />
            {isSaldoLoading && <p className="text-muted-foreground text-sm">Ładowanie salda...</p>}
            {saldo !== null && !isSaldoLoading && (
              <p className="text-sm">
                Aktualne saldo: <span className="font-medium">{formatPLN(saldo)}</span>
              </p>
            )}

            {/* Mode toggle */}
            <form.AppField name="mode">
              {(field) => (
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name="settlementMode"
                      value="investment"
                      checked={field.state.value === 'investment'}
                      onChange={() => field.handleChange('investment')}
                    />
                    Inwestycja
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name="settlementMode"
                      value="category"
                      checked={field.state.value === 'category'}
                      onChange={() => field.handleChange('category')}
                    />
                    Inne (kategoria)
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name="settlementMode"
                      value="register"
                      checked={field.state.value === 'register'}
                      onChange={() => field.handleChange('register')}
                    />
                    Transfer do kasy
                  </label>
                </div>
              )}
            </form.AppField>

            {/* Shared metadata */}
            {mode === 'investment' && (
              <>
                <InvestmentField form={form} investments={referenceData.investments} />
                <form.AppField name="expenseCategory">
                  {(field) => (
                    <field.Select
                      label="Kategoria wydatku"
                      placeholder="Wybierz kategorię"
                      showError
                    >
                      {referenceData.expenseCategories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </field.Select>
                  )}
                </form.AppField>
              </>
            )}

            {mode === 'register' && (
              <CashRegisterField form={form} cashRegisters={referenceData.cashRegisters} />
            )}

            {/* PaymentMethodField — temporarily hidden, always CASH */}
            {/* <PaymentMethodField form={form} /> */}

            {/* Register mode: single amount + description */}
            {mode === 'register' && (
              <>
                <AmountField form={form} />
                <DescriptionField form={form} placeholder="Opis zwrotu (opcjonalnie)" />
              </>
            )}

            {/* Line items (investment + category modes only) */}
            {mode !== 'register' && (
              <LineItemsField
                form={form}
                label="Faktura"
                emptyItem={{ description: '', amount: '', category: '', note: '' }}
                total={total}
                onRemoveItem={handleRemoveLineItem}
                onFileChange={handleFileChange}
                renderItemExtras={
                  mode === 'category'
                    ? (index) => (
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
                                label="Kategoria"
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
                              <field.Input
                                label="Notatka"
                                placeholder="Notatka do pozycji"
                                showError
                              />
                            )}
                          </form.AppField>
                        </div>
                      )
                    : undefined
                }
              />
            )}

            {/* Invoice note (investment + category modes only) */}
            {mode !== 'register' && (
              <form.AppField name="invoiceNote">
                {(field) => <field.Textarea label="Notatka" showError />}
              </form.AppField>
            )}
          </FieldGroup>

          {/* Summary */}
          {saldo !== null && (
            <div className="bg-muted/50 border-border mt-6 space-y-1 rounded-lg border px-6 py-4">
              <p className="text-sm">
                Aktualne saldo: <span className="font-medium">{formatPLN(saldo)}</span>
              </p>
              <p className="text-sm">
                Suma rozliczenia: <span className="font-medium">{formatPLN(total)}</span>
              </p>
              <p className="text-sm">
                Saldo po rozliczeniu:{' '}
                <span className="font-medium">{formatPLN(saldo - total)}</span>
              </p>
            </div>
          )}

          <div className="mt-6">
            <FormFooter label={submitLabel} submittingLabel="Przetwarzanie..." />
          </div>
        </form>
      </form.AppForm>
    </div>
  )
}
