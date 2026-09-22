'use client'

import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { useFilePickIngest } from '@/components/forms/hooks/use-file-pick-ingest'
import {
  showsInvestment,
  needsExpenseCategory,
  isLaborCost,
  canFillVatPlane,
  planeFor,
  PAYMENT_METHOD_PLANE_LABELS,
} from '@/lib/constants/transfers'
import { editTransferFormSchema } from '@/lib/schemas/transfer-form'
import type { EditTransferFormValuesT } from './edit-transfer-form-api'
import { submitWithUploads } from '@/lib/media/submit-with-uploads'
import { useInvoiceRemoval } from '@/hooks/use-invoice-removal'
import type { UpdateTransferFormT } from '@/lib/schemas/transfer'
import type { TransferRowT } from '@/types/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import { updateTransferAction } from '@/lib/actions/transfers'
import { planeFillIn, UNANSWERED_PAYMENT_METHOD } from '@/lib/transfers/plane-fill-in'
import {
  AmountField,
  DateField,
  DescriptionField,
  EntityComboboxField,
  PaymentMethodField,
} from '@/components/forms/form-fields'
import { ExpenseCategoryField } from '@/components/forms/edit-transfer-form/expense-category-field'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormClearButton } from '../form-components/form-clear-button'

type EditTransferFormPropsT = {
  row: TransferRowT
  referenceData: ReferenceDataBaseT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

const FORM_ID = 'edit-transfer'

export function EditTransferForm({
  row,
  referenceData,
  onSubmitSuccess,
  keepOpen,
}: EditTransferFormPropsT) {
  const { submit } = useFormSubmit(FORM_ID)

  const fillsPlane = canFillVatPlane(row)
  const { files, isIngesting, inputKey, fileInputProps, reset: resetFiles } = useFilePickIngest()

  // A bare reset is right HERE and nowhere else: this form persists no draft, so its `defaultValues`
  // really are the row — „wyczyść" means „back to what is saved", not „blank".
  function handleReset() {
    form.reset()
    resetFiles()
  }

  const form = useAppForm({
    defaultValues: {
      description: row.description,
      amount: isLaborCost(row.type) ? String(row.amount) : undefined,
      date: row.date.slice(0, 10),
      paymentMethod: fillsPlane ? UNANSWERED_PAYMENT_METHOD : (row.paymentMethod ?? ''),
      investment: row.investmentId ? String(row.investmentId) : '',
      expenseCategory: row.expenseCategoryId ? String(row.expenseCategoryId) : '',
      otherCategory: row.otherCategoryId ? String(row.otherCategoryId ?? '') : '',
      invoiceNote: row.invoiceNote ?? '',
      netAmount: '',
    } as EditTransferFormValuesT,
    validators: {
      onSubmit: editTransferFormSchema(row),
    },
    onSubmit: async ({ value }) => {
      const data: UpdateTransferFormT = {
        description: value.description,
        amount: value.amount ? Number(value.amount) : undefined,
        date: value.date,
        ...planeFillIn(row, value.paymentMethod, value.netAmount ?? ''),
        investment: value.investment ? Number(value.investment) : undefined,
        expenseCategory: value.expenseCategory ? Number(value.expenseCategory) : undefined,
        otherCategory: value.otherCategory ? Number(value.otherCategory) : undefined,
        invoiceNote: value.invoiceNote || undefined,
      }

      await submit(!!keepOpen, {
        action: async () => {
          // Enter bypasses the disabled submit button, so the guard has to exist here too —
          // saving mid-ingest would persist the row without the pages still being converted.
          if (isIngesting) return { success: false, error: 'Poczekaj na przetworzenie plików.' }

          return submitWithUploads(files, (pageIds) =>
            // `undefined` means "no pages this save" to an update that only ever ADDS invoices.
            updateTransferAction(row.id, data, pageIds.length > 0 ? pageIds : undefined),
          )
        },
        successMessage: 'Transakcja zaktualizowana',
        onSubmitSuccess,
        onReset: handleReset,
      })

      return false
    },
  })

  useCheckFormErrors(form)

  // Gate the type field on the LIVE investment value, not row.investmentId — the
  // investment is editable here, so adding one to a correction must reveal the
  // type field without a reload (matches the create form's currentInvestment).
  const currentInvestment = useStore(form.store, (s) => s.values.investment)
  const currentPaymentMethod = useStore(form.store, (s) => s.values.paymentMethod)

  // Removal is immediate (its own action), unlike the rest of this form which applies on „Zapisz" —
  // the file input below only ever ADDS pages, so there is no other way to drop one here.
  const { visibleInvoices, handleRemove, handleRemoveAll, removalConfirm } = useInvoiceRemoval(
    row.id,
    row.invoices,
  )

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
          <DescriptionField form={form} />

          {isLaborCost(row.type) && <AmountField form={form} />}

          <DateField form={form} />

          {/* Payment method is otherwise hidden — only CASH is currently used. The one exception is
              the plane fill-in below. */}

          {showsInvestment(row.type) && (
            <EntityComboboxField
              form={form}
              variant="investment"
              items={referenceData.investments}
            />
          )}

          {needsExpenseCategory(row.type, !!currentInvestment) && (
            <ExpenseCategoryField form={form} expenseCategories={referenceData.expenseCategories} />
          )}

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

          {/* Retagging a wpłata that HAS a plane stays refused (owner, 2026-08-20) — that goes the
              way that leaves a trail, anuluj i zaksięguj na nowo. Offered here only for a legacy row,
              which rewrites nothing. Asked as the METHOD, because that is what the owner remembers;
              „Nie określono" is the default so a save about something else cannot answer it. */}
          {fillsPlane && (
            <>
              <PaymentMethodField
                form={form}
                label="Forma wpłaty"
                labels={PAYMENT_METHOD_PLANE_LABELS}
                leadingOption={
                  <SelectItem value={UNANSWERED_PAYMENT_METHOD}>Nie określono</SelectItem>
                }
              />
              {planeFor(row.type, currentPaymentMethod) === 'GROSS' && (
                <form.AppField name="netAmount">
                  {(field) => (
                    <field.Input
                      label="Kwota netto z faktury (PLN)"
                      placeholder="0.00"
                      type="number"
                      showError
                    />
                  )}
                </form.AppField>
              )}
            </>
          )}

          <form.AppField name="invoiceNote">
            {(field) => (
              <field.Textarea label="Notatka" placeholder="Wpisz notatkę..." rows={3} showError />
            )}
          </form.AppField>

          <div className="space-y-2">
            {visibleInvoices.length > 0 && files.length === 0 && (
              <MediaPreviewButton
                labels={INVOICE_PREVIEW_LABELS}
                files={visibleInvoices}
                onRemove={handleRemove}
                onRemoveAll={visibleInvoices.length > 1 ? handleRemoveAll : undefined}
              />
            )}
            <FileInput
              key={inputKey}
              label="Dodaj faktury"
              accept="image/*,application/pdf"
              multiple
              {...fileInputProps}
            />
          </div>
        </FieldGroup>

        <FormFooter
          label="Zapisz"
          submittingLabel="Zapisywanie..."
          className="mt-6"
          disabled={isIngesting}
        />
      </form>

      <ConfirmDialog {...removalConfirm} />
    </form.AppForm>
  )
}
