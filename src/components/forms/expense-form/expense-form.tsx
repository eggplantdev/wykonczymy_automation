'use client'

import { useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useInvoiceIngest } from '@/components/forms/expense-form/use-invoice-ingest'
import { useReceiptGeneration } from '@/components/forms/expense-form/use-receipt-generation'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { useRegisterBalance } from '@/components/forms/hooks/use-register-balance'
import { useInvestmentFromUrl } from '@/components/forms/hooks/use-investment-from-url'
import {
  DEFAULT_EXPENSE_CATEGORY_NAME,
  TRANSACTION_TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  billsNetAmount,
  isDepositType,
  needsSourceRegister,
  showsInvestment,
  needsTargetRegister,
  needsWorker,
  canBeSettled,
  carriesPaymentMethod,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import { mapLineItem } from '@/components/forms/expense-form/map-line-item'
import { resolveExpenseCategoryId } from '@/components/forms/expense-form/resolve-expense-category-id'
import { restorableType } from '@/components/forms/expense-form/draft-type'
import {
  investmentForType,
  sourceRegisterForType,
  staleFieldsForType,
} from '@/lib/transfers/clear-fields-for-type'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { positionalFiles } from '@/lib/invoices/row-file-positions'
import { submitWithInvoicePageRows } from '@/lib/invoices/submit-with-invoice-pages'
import { toastMessage } from '@/lib/utils/toast'
import {
  getDefaultCashRegister,
  getUserDefaultCashRegisterId,
} from '@/lib/utils/default-cash-register'
import {
  bulkExpenseFormSchema,
  type CreateBulkExpenseFormT,
} from '@/components/forms/expense-form/bulk-expense-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { today } from '@/lib/utils/date'
import {
  CashRegisterField,
  DateField,
  EntityComboboxField,
  PaymentMethodField,
  SourceRegisterField,
  LineItemsField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormShell } from '../form-components/form-shell'
import { RegisterBalanceSummary } from '../form-components/register-balance-summary'
import { useExpenseFormStore } from '@/stores/form-stores'
import { isBookableInvestment } from '@/lib/constants/investment-lock'

type TransferFormPropsT = {
  referenceData: ReferenceDataT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

// Form state uses strings since HTML inputs/selects work with strings.
// Numeric conversion happens in the server action.
type FormValuesT = BulkExpenseFormValuesT

const FORM_ID = 'expense'

export function ExpenseForm({ referenceData, onSubmitSuccess, keepOpen }: TransferFormPropsT) {
  const { recoveredFiles, submit } = useFormSubmit(FORM_ID)

  // Scoped by formId like every other draft consumer: `'expense'` is the only writer today, but the
  // day an „Edytuj wydatek" dialog shares this slot its draft would otherwise seed the create form.
  const storedFormId = useExpenseFormStore((s) => s.formId)
  const draft = useExpenseFormStore((s) => s.formData)
  const storedValues = storedFormId === FORM_ID ? draft : null
  const updateFormData = useExpenseFormStore((s) => s.updateFormData)
  const resetFormData = useExpenseFormStore((s) => s.resetFormData)

  const { registerBalance, isRegisterBalanceLoading, fetchRegisterBalance, resetRegisterBalance } =
    useRegisterBalance()

  const {
    ingestingIds,
    isIngesting,
    registerFiles,
    attachFile,
    // Keyed by id, so surviving rows' markers/files need no shift and the reactive store
    // re-renders the removed row on its own.
    handleRemoveLineItem,
    removeFileAt,
    getRowFiles,
    getFiles,
    renameFile,
    reset: resetInvoiceFiles,
  } = useInvoiceIngest({ recoveredFiles, storedLineItems: storedValues?.lineItems })

  const defaultExpenseCategory = resolveExpenseCategoryId(
    DEFAULT_EXPENSE_CATEGORY_NAME,
    referenceData.expenseCategories,
  )

  function handleReset() {
    // Not plain `blankValues`: that snapshot is frozen at first render, so a default kasa pinned
    // from inside this dialog (the button below the kasa field) would be undone by „Wyczyść" until
    // the dialog was closed and reopened.
    form.reset({ ...blankValues, sourceRegister: getDefaultCashRegister(referenceData) })
    // Fresh id so the row remounts and its uncontrolled FileInput drops the native FileList no reset
    // reaches. Set apart from the reset above, not folded into it: reset adopts whatever it is given
    // as the new defaults, and the next render would swap the stale row back in. Meta-free, or the
    // draft listener re-persists what was just cleared.
    form.setFieldValue('lineItems', [makeLineItem({ expenseCategory: defaultExpenseCategory })], {
      dontUpdateMeta: true,
      dontRunListeners: true,
    })
    resetFormData()
    resetRegisterBalance()
    resetInvoiceFiles()
    resetGeneration()
  }

  // Fills the select only when it would otherwise be empty — a draft that already names an
  // investment keeps it, so navigating between investments never rewrites a half-filled form.
  const investmentFromUrl = useInvestmentFromUrl(referenceData.investments)

  // Held in state, not rebuilt inline: makeLineItem() mints a fresh uuid, so an inline literal
  // handed to useAppForm was a new defaultValues on every render — the form re-applied it, which
  // re-rendered, which minted another id → "Maximum update depth exceeded" the moment the dialog opened.
  const [blankValues] = useState<FormValuesT>(() => ({
    date: today(),
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: '',
    sourceRegister: getDefaultCashRegister(referenceData),
    targetRegister: '',
    investment: investmentFromUrl,
    worker: '',
    settled: false,
    lineItems: [makeLineItem({ expenseCategory: defaultExpenseCategory })],
  }))

  const initialValues = storedValues
    ? {
        ...storedValues,
        investment: storedValues.investment || investmentFromUrl,
        // A draft saved before a type left the dialog would restore a value the Select cannot render:
        // it shows empty while the form still submits the removed type, which the server accepts.
        // Coerced rather than dropping the whole draft — one stale field is not worth discarding
        // everything the user typed.
        type: restorableType(storedValues.type),
      }
    : blankValues

  const form = useAppForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: bulkExpenseFormSchema,
    },
    listeners: {
      onChange: ({ formApi }) => updateFormData(FORM_ID, formApi.state.values as FormValuesT),
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      // Backstop to the disabled submit button (a keyboard Enter can bypass it): a row still
      // ingesting hasn't stored its processed file yet, so getFiles() would read undefined for it
      // and the line item would save without its receipt — silent loss.
      if (isIngesting) {
        toastMessage('Poczekaj na przetworzenie plików.', 'warning', 4000)
        return false
      }

      const type = value.type as TransferTypeT
      const data: CreateBulkExpenseFormT = {
        date: value.date,
        type,
        paymentMethod: (value.paymentMethod as PaymentMethodT) || null,
        sourceRegister: value.sourceRegister ? Number(value.sourceRegister) : undefined,
        targetRegister: value.targetRegister ? Number(value.targetRegister) : undefined,
        investment: value.investment ? Number(value.investment) : undefined,
        worker: value.worker ? Number(value.worker) : undefined,
        settled: value.settled,
        lineItems: value.lineItems.map((item) => mapLineItem(item, type, !!value.investment)),
      }

      // Cross the id→position seam once, here: the upload contract and the optimistic-store
      // snapshot (persisted for recovery) are both positional (mediaIds[i] ↔ lineItems[i]).
      const files = positionalFiles(value.lineItems, getFiles())

      await submit(!!keepOpen, {
        // Submit is the only upload site: the AI scan sends raw bytes and persists nothing, so
        // every attached file is uploaded once here.
        action: () =>
          submitWithInvoicePageRows(value.lineItems.length, files, (invoicePageRows) =>
            createBulkTransferAction(data, invoicePageRows),
          ),
        successMessage: 'Transakcje dodane',
        files,
        onSubmitSuccess,
        onReset: handleReset,
      })

      return false
    },
  })

  useCheckFormErrors(form)

  const {
    generateFromReceipts,
    isGenerating,
    generatingIds,
    failedIds,
    generationProgress,
    resetGeneration,
  } = useReceiptGeneration({
    form,
    otherCategories: referenceData.otherCategories,
    getFiles,
    renameFile,
  })

  // The reactive file store re-renders each FV label as generateFromReceipts renames its file — no
  // remount needed, so this is just the scan.
  const handleGenerate = generateFromReceipts

  const currentType = useStore(form.store, (s) => s.values.type)
  const currentInvestment = useStore(form.store, (s) => s.values.investment)
  const lineItems = useStore(form.store, (s) => s.values.lineItems)
  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  // Blanked, never reset — see clear-fields-for-type. Top-level fields ONLY: the rows, their queued
  // invoice files and the per-row scan markers all survive a type change.
  //
  // They used to be wiped here, which cost the user a paid receipt scan and the re-attached file
  // every time they picked the type after scanning — the order `use-receipt-generation` itself
  // assumes, since the scan is what fills the row. The hazard that wipe cited (a queued file
  // binding to a nonexistent row) cannot happen: files are keyed by row id and `positionalFiles`
  // resolves them against the CURRENT rows, dropping a stale id rather than mis-binding it. Nor can
  // a retained value reach the wire — `mapLineItem` drops every conditional per-row field off a type
  // that does not show it. Clearing everything stays on „Wyczyść".
  function resetConditionalFields(type: string) {
    staleFieldsForType(type).forEach(([field, value]) => form.setFieldValue(field, value))
    form.setFieldValue(
      'investment',
      investmentForType(type, form.getFieldValue('investment'), investmentFromUrl),
    )
    form.setFieldValue(
      'sourceRegister',
      sourceRegisterForType(
        type,
        form.getFieldValue('sourceRegister'),
        getDefaultCashRegister(referenceData),
      ),
    )
    // The kasa may have just been blanked above, so the balance beside it no longer describes it.
    resetRegisterBalance()
  }

  return (
    <FormShell form={form} onReset={handleReset}>
      <FieldGroup>
        {/* The netto hint sits UNDER the row, not on the Select as a `description` — FormBase
          renders a description between the label and the control, which would push the type
          Select down while „Data" beside it stayed put, breaking the row's alignment. */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-4">
            <form.AppField
              name="type"
              listeners={{ onChange: ({ value }) => resetConditionalFields(value) }}
            >
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
          {billsNetAmount(currentType) && (
            <FieldDescription>
              Z kasy schodzi kwota brutto, a inwestora obciąża kwota netto — dlatego przy każdej
              pozycji podajesz obie.
            </FieldDescription>
          )}
        </div>

        {showsInvestment(currentType) && (
          <EntityComboboxField
            form={form}
            variant="investment"
            items={referenceData.investments.filter(isBookableInvestment)}
          />
        )}

        {canBeSettled(currentType) && (
          <form.AppField name="settled">
            {(field) => (
              <field.Checkbox label="Wliczone w robociznę (materiał w cenie robocizny — nie obciąża inwestora)" />
            )}
          </form.AppField>
        )}

        {needsSourceRegister(currentType) && (
          <SourceRegisterField
            form={form}
            cashRegisters={referenceData.cashRegisters}
            registerBalance={registerBalance}
            isRegisterBalanceLoading={isRegisterBalanceLoading}
            fetchRegisterBalance={fetchRegisterBalance}
            showSaveAsDefault
            defaultCashRegisterId={getUserDefaultCashRegisterId(referenceData)}
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

        {carriesPaymentMethod(currentType) && <PaymentMethodField form={form} />}

        {needsWorker(currentType) && (
          <EntityComboboxField form={form} variant="worker" items={referenceData.workers} />
        )}

        {!isDepositType(currentType) && (
          <LineItemsField
            form={form}
            total={total}
            hasInvestment={!!currentInvestment}
            onRemoveItem={handleRemoveLineItem}
            onFileChange={attachFile}
            onRemoveFile={removeFileAt}
            onRegisterFiles={registerFiles}
            getRowFiles={getRowFiles}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            generatingIds={generatingIds}
            ingestingIds={ingestingIds}
            failedIds={failedIds}
            generationProgress={generationProgress}
            transferType={currentType}
            referenceData={referenceData}
            defaultExpenseCategory={defaultExpenseCategory}
          />
        )}
      </FieldGroup>

      {registerBalance !== null && (
        <RegisterBalanceSummary registerBalance={registerBalance} total={total} />
      )}

      <FormFooter className="mt-6" label="Zapisz" disabled={isIngesting} />
    </FormShell>
  )
}
