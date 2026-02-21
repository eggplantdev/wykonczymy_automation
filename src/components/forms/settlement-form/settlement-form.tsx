'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { SelectItem } from '@/components/ui/select'
import { FileInput } from '@/components/ui/file-input'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useFormStatus } from '@/components/forms/hooks/use-form-status'
import useCheckFormErrors from '@/components/forms/hooks/use-check-form-errors'
import { Loader } from '@/components/ui/loader/loader'
import { toastMessage } from '@/components/toasts'
import { formatPLN } from '@/lib/format-currency'
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { getManagementEmployeeSaldo } from '@/lib/queries/employees'
import { createSettlementAction } from '@/lib/actions/settlements'
import { cn } from '@/lib/cn'
import { today } from '@/lib/date-utils'
import { settlementFormSchema, type CreateSettlementFormT } from './settlement-schema'
import type { ReferenceItemT } from '@/types/reference-data'

type SettlementReferenceDataT = {
  users: ReferenceItemT[]
  investments: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
}

type SettlementFormPropsT = {
  referenceData: SettlementReferenceDataT
  className?: string
  onSuccess?: () => void
}

type FormValuesT = {
  worker: string
  mode: 'investment' | 'category'
  investment?: string
  date: string
  paymentMethod: string
  invoiceNote: string
  lineItems: { description: string; amount: string; category?: string; note?: string }[]
}

export function SettlementForm({ referenceData, className, onSuccess }: SettlementFormPropsT) {
  const router = useRouter()
  const invoiceFilesRef = useRef<Map<number, File>>(new Map())

  // Saldo is display-only, not form data
  const [saldo, setSaldo] = useState<number | null>(null)
  const [isSaldoLoading, setIsSaldoLoading] = useState(false)

  const form = useAppForm({
    defaultValues: {
      worker: '',
      mode: 'investment' as const,
      investment: '',
      date: today(),
      paymentMethod: 'CASH',
      invoiceNote: '',
      lineItems: [{ description: '', amount: '', category: '', note: '' }],
    } as FormValuesT,
    validators: {
      onSubmit: settlementFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: CreateSettlementFormT = {
        worker: Number(value.worker),
        mode: value.mode,
        investment: value.mode === 'investment' ? Number(value.investment) : undefined,
        date: value.date,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        invoiceNote: value.invoiceNote || undefined,
        lineItems: value.lineItems.map((item) => ({
          description: item.description,
          amount: Number(item.amount),
          category: value.mode === 'category' ? Number(item.category) : undefined,
          note: value.mode === 'category' ? item.note : undefined,
        })),
      }

      let invoiceFormData: FormData | null = null
      if (invoiceFilesRef.current.size > 0) {
        invoiceFormData = new FormData()
        invoiceFilesRef.current.forEach((file, index) => {
          invoiceFormData!.set(`invoice-${index}`, file)
        })
      }

      const result = await createSettlementAction(data, invoiceFormData)

      if (result.success) {
        toastMessage(`Dodano`, 'success')
        if (onSuccess) onSuccess()
        else router.push('/')
      } else {
        toastMessage(result.error, 'error')
      }

      return false
    },
  })

  useCheckFormErrors(form)

  const lineItems = useStore(form.store, (s) => s.values.lineItems)
  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const mode = useStore(form.store, (s) => s.values.mode)

  const { isInvalid, isSubmitting } = useFormStatus(form)

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
            <form.AppField
              name="worker"
              listeners={{
                onChange: ({ value }) => {
                  fetchSaldo(value)
                },
              }}
            >
              {(field) => (
                <field.Select label="Pracownik" placeholder="Wybierz pracownika" showError>
                  {referenceData.users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>

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
                </div>
              )}
            </form.AppField>

            {/* Shared metadata */}
            <div className="grid gap-4 md:grid-cols-2">
              {mode === 'investment' && (
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

              <form.AppField name="date">
                {(field) => <field.Input label="Data" type="date" showError />}
              </form.AppField>

              <form.AppField name="paymentMethod">
                {(field) => (
                  <field.Select label="Metoda płatności" showError>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method as PaymentMethodT]}
                      </SelectItem>
                    ))}
                  </field.Select>
                )}
              </form.AppField>
            </div>

            {/* Line items */}
            <form.Field name="lineItems" mode="array">
              {(lineItemsField) => (
                <div className="space-y-4">
                  <p className="text-foreground text-sm font-medium">Pozycje faktury</p>
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
                      <FileInput
                        accept="image/*,application/pdf"
                        onChange={(e) => handleFileChange(index, e)}
                      />
                      {mode === 'category' && (
                        <div className="grid gap-2 md:grid-cols-2">
                          <form.AppField name={`lineItems[${index}].category`}>
                            {(field) => (
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
                            {(field) => (
                              <field.Input
                                label="Notatka"
                                placeholder="Notatka do pozycji"
                                showError
                              />
                            )}
                          </form.AppField>
                        </div>
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
                        category: '',
                        note: '',
                      })
                    }
                  >
                    Dodaj pozycję
                  </Button>
                  <p className="text-foreground text-sm font-medium">Suma: {formatPLN(total)}</p>
                </div>
              )}
            </form.Field>

            {/* Invoice note */}
            <form.AppField name="invoiceNote">
              {(field) => (
                <field.Textarea
                  label="Notatka do faktury"
                  placeholder="Wymagane dla pozycji bez faktury"
                  showError
                />
              )}
            </form.AppField>
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

          {/* Submit */}
          <footer className="mt-6">
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Przetwarzanie...' : `Rozlicz (${lineItems.length} pozycji`}
            </Button>
            {isInvalid && (
              <p className="text-destructive mt-2 text-sm font-medium">Formularz zawiera błędy</p>
            )}
          </footer>
          <Loader loading={isSubmitting} portal />
        </form>
      </form.AppForm>
    </div>
  )
}
