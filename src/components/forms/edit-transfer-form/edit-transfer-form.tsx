'use client'

import { useRef, useState } from 'react'
import { InvoiceThumbnail } from '@/components/invoice-thumbnail'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import {
  showsInvestment,
  needsExpenseCategory,
  isLaborCost,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { editExpenseFormSchema } from '@/components/forms/expense-form/expense-schema'
import { uploadFileClient } from '@/lib/upload-file-client'
import type { z } from 'zod'
import type { UpdateTransferFormT } from '@/lib/schemas/transfer'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'
import { updateTransferAction } from '@/lib/actions/transfers'
import {
  AmountField,
  DateField,
  DescriptionField,
  EntityComboboxField,
  ExpenseCategoryField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormClearButton } from '../form-components/form-clear-button'

type EditTransferFormPropsT = {
  row: TransferRowT
  referenceData: ReferenceDataBaseT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

type FormValuesT = z.infer<typeof editExpenseFormSchema>

const FORM_ID = 'edit-transfer'

export function EditTransferForm({
  row,
  referenceData,
  onSubmitSuccess,
  keepOpen,
}: EditTransferFormPropsT) {
  const { submit } = useFormSubmit(FORM_ID)
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | undefined>()

  const form = useAppForm({
    defaultValues: {
      description: row.description,
      amount: isLaborCost(row.type) ? String(row.amount) : undefined,
      date: row.date.slice(0, 10),
      paymentMethod: row.paymentMethod,
      investment: row.investmentId ? String(row.investmentId) : '',
      expenseCategory: row.expenseCategoryId ? String(row.expenseCategoryId) : '',
      otherCategory: row.otherCategoryId ? String(row.otherCategoryId ?? '') : '',
      invoiceNote: row.invoiceNote ?? '',
    } as FormValuesT,
    validators: {
      onSubmit: editExpenseFormSchema,
    },
    onSubmit: async ({ value }) => {
      const data: UpdateTransferFormT = {
        description: value.description,
        amount: value.amount ? Number(value.amount) : undefined,
        date: value.date,
        paymentMethod: value.paymentMethod as PaymentMethodT,
        investment: value.investment ? Number(value.investment) : undefined,
        expenseCategory: value.expenseCategory ? Number(value.expenseCategory) : undefined,
        otherCategory: value.otherCategory ? Number(value.otherCategory) : undefined,
        invoiceNote: value.invoiceNote || undefined,
      }

      // Capture file before dialog closes — the ref won't be available after unmount
      const file = fileRef.current?.files?.[0]

      await submit(!!keepOpen, {
        form,
        action: async () => {
          let invoiceMediaId: number | undefined
          if (file) {
            try {
              invoiceMediaId = await uploadFileClient(file)
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Nie udało się przesłać pliku'
              return { success: false, error: message }
            }
          }
          return updateTransferAction(row.id, data, invoiceMediaId)
        },
        successMessage: 'Transakcja zaktualizowana',
        onSubmitSuccess,
      })

      return false
    },
  })

  useCheckFormErrors(form)

  function handleFileChange() {
    const file = fileRef.current?.files?.[0]
    setSelectedFileName(file?.name)
  }

  return (
    <form.AppForm>
      <FormClearButton />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          <DescriptionField form={form} />

          {isLaborCost(row.type) && <AmountField form={form} />}

          <DateField form={form} />

          {/* Payment method hidden — only CASH is currently used */}

          {showsInvestment(row.type) && (
            <EntityComboboxField
              form={form}
              name="investment"
              items={referenceData.investments}
              label="Inwestycja"
              placeholder="Wybierz inwestycję"
              searchPlaceholder="Szukaj inwestycji..."
              emptySearchMessage="Nie znaleziono inwestycji."
              noItemsMessage="Brak inwestycji"
              noActiveItemsMessage="Brak aktywnych inwestycji"
            />
          )}

          {needsExpenseCategory(row.type) && (
            <ExpenseCategoryField form={form} expenseCategories={referenceData.expenseCategories} />
          )}

          <form.AppField name="otherCategory">
            {(field: AppFieldComponentsT) => (
              <field.Select label="Kategoria" placeholder="Wybierz kategorię" showError>
                {referenceData.otherCategories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          <form.AppField name="invoiceNote">
            {(field: AppFieldComponentsT) => (
              <field.Textarea label="Notatka" placeholder="Wpisz notatkę..." rows={3} showError />
            )}
          </form.AppField>

          <div className="space-y-2">
            {row.invoiceUrl && !selectedFileName && (
              <InvoiceThumbnail
                url={row.invoiceUrl}
                filename={row.invoiceFilename}
                mimeType={row.invoiceMimeType}
              />
            )}
            <FileInput
              ref={fileRef}
              label={row.invoiceUrl ? 'Zamień fakturę' : 'Dodaj fakturę'}
              accept="image/*,application/pdf"
              placeholder={selectedFileName ?? 'Przeciągnij lub kliknij'}
              onChange={handleFileChange}
            />
          </div>
        </FieldGroup>

        <FormFooter label="Zapisz" submittingLabel="Zapisywanie..." className="mt-6" />
      </form>
    </form.AppForm>
  )
}
