'use client'

import { useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useInvoiceIngest } from '@/components/forms/expense-form/use-invoice-ingest'
import { useReceiptGeneration } from '@/components/forms/expense-form/use-receipt-generation'
import { useParagonDecisions } from '@/components/forms/expense-form/use-paragon-decisions'
import { ParagonFooter } from '@/components/forms/expense-form/paragon-footer'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { useSubmitConfirm } from '@/components/forms/hooks/use-submit-confirm'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { missingInvoiceConfirm } from '@/lib/transfers/missing-invoice-confirm'
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
  isInvestmentExpense,
} from '@/lib/constants/transfers'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import { toBulkData } from '@/components/forms/expense-form/to-bulk-data'
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
import { positionalFiles } from '@/components/forms/expense-form/row-file-positions'
import { submitWithUploadRows } from '@/lib/media/submit-with-uploads'
import { toastMessage } from '@/lib/utils/toast'
import {
  getDefaultCashRegister,
  getUserDefaultCashRegisterId,
} from '@/lib/utils/default-cash-register'
import { bulkExpenseFormSchema } from '@/components/forms/expense-form/bulk-expense-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { warsawToday } from '@/lib/utils/days'
import {
  CashRegisterField,
  DateField,
  EntityComboboxField,
  PaymentMethodField,
  SourceRegisterField,
} from '@/components/forms/form-fields'
import { LineItemsField } from '@/components/forms/expense-form/line-items-field'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormShell } from '../form-components/form-shell'
import { RegisterBalanceSummary } from '../form-components/register-balance-summary'
import { useExpenseFormStore } from '@/stores/form-stores'
import { isBookableInvestment, isOfferedForBooking } from '@/lib/constants/investment-lock'
import { canBookTransferType } from '@/lib/auth/roles'
import { receiptDecision, type DraftReceiptT } from '@/lib/worker-expenses/receipt-decision'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import type { ExpenseDraftReadRowT } from '@/lib/db/expense-draft-read'
import type { RejectedReceiptT } from '@/lib/db/worker-expense-drafts'
import type { DecisionStatusT } from '@/components/ui/decision-progress-badge'

type FormValuesT = BulkExpenseFormValuesT

export type ParagonRowT = { itemId: string; position: number; status: DecisionStatusT }

export type ExpenseFormPrefillT = {
  values: FormValuesT
  files: Map<number, File[]>
  expenseDraftId: number
  receipts: Map<string, DraftReceiptT[]>
  aiReadRows: ExpenseDraftReadRowT[]
  pagesByMediaId: Map<number, File>
  rejectedReceipts?: RejectedReceiptT[]
  acceptedReadRows?: number[]
}

type TransferFormPropsT = {
  referenceData: ReferenceDataT
  onSubmitSuccess: () => void
  keepOpen?: boolean
  formId?: string
  prefill?: ExpenseFormPrefillT
  isPrefillReading?: boolean
  isSaveBlocked?: boolean
  secondaryAction?: React.ReactNode
  onDecided?: () => void
  onRemoveLastItem?: (duplicateOf?: DuplicateOfT) => void
  aboveLineItems?: React.ReactNode
  wrapLineItem?: (api: {
    itemId: string
    markDuplicate: (itemId: string, duplicateOf: DuplicateOfT) => void
    paragonOfReadRow: (readRow: number) => ParagonRowT | undefined
    disabled: boolean
    renderRow: (hint: React.ReactNode) => React.ReactNode
  }) => React.ReactNode
}

const FORM_ID = 'expense'

export function ExpenseForm({
  referenceData,
  onSubmitSuccess,
  keepOpen,
  formId = FORM_ID,
  prefill,
  isPrefillReading = false,
  isSaveBlocked = false,
  secondaryAction,
  onRemoveLastItem,
  aboveLineItems,
  wrapLineItem,
  onDecided,
}: TransferFormPropsT) {
  const isParagonMode = !!prefill && prefill.aiReadRows.length > 0
  const [hiddenStatuses, setHiddenStatuses] = useState<ReadonlySet<DecisionStatusT>>(
    () => new Set(['accepted', 'rejected']),
  )
  const { recoveredFiles, submit } = useFormSubmit(formId)
  const { ask, dialogProps: missingInvoiceDialog } = useSubmitConfirm()
  const [duplicateOfByItemId, setDuplicateOfByItemId] = useState(
    () => new Map<string, DuplicateOfT>(),
  )

  const storedFormId = useExpenseFormStore((s) => s.formId)
  const draft = useExpenseFormStore((s) => s.formData)
  const storedValues = storedFormId === formId ? draft : null
  const updateFormData = useExpenseFormStore((s) => s.updateFormData)
  const resetFormData = useExpenseFormStore((s) => s.resetFormData)

  const { registerBalance, isRegisterBalanceLoading, fetchRegisterBalance, resetRegisterBalance } =
    useRegisterBalance()

  const {
    ingestingIds,
    isIngesting,
    registerFiles,
    attachFile,
    handleRemoveLineItem,
    replaceRows,
    removeFileAt,
    getRowFiles,
    getFiles,
    renameFile,
    reset: resetInvoiceFiles,
  } = useInvoiceIngest(
    prefill
      ? { recoveredFiles: prefill.files, storedLineItems: prefill.values.lineItems }
      : { recoveredFiles, storedLineItems: storedValues?.lineItems },
  )

  const draftMediaIds = new Map(
    [...(prefill?.pagesByMediaId ?? [])].map(([id, page]) => [page, id]),
  )
  const draftMediaIdOf = (file: File) => draftMediaIds.get(file)

  const defaultExpenseCategory = resolveExpenseCategoryId(
    DEFAULT_EXPENSE_CATEGORY_NAME,
    referenceData.expenseCategories,
  )

  function handleReset() {
    // Not plain `blankValues`: that snapshot is frozen at first render, so a default kasa pinned
    // from inside this dialog would be undone by „Wyczyść".
    form.reset({ ...blankValues, sourceRegister: getDefaultCashRegister(referenceData) })
    // Set apart from the reset above: reset adopts whatever it is given as the new defaults, and the
    // next render would swap the stale row back in.
    form.setFieldValue('lineItems', [makeLineItem({ expenseCategory: defaultExpenseCategory })], {
      dontUpdateMeta: true,
      dontRunListeners: true,
    })
    if (!prefill) resetFormData()
    resetRegisterBalance()
    resetInvoiceFiles()
    resetGeneration()
    setDuplicateOfByItemId(new Map())
  }

  const investmentFromUrl = useInvestmentFromUrl(referenceData.investments)

  // Held in state, not rebuilt inline: makeLineItem() mints a fresh uuid → "Maximum update depth
  // exceeded" the moment the dialog opened.
  const [blankValues] = useState<FormValuesT>(() => ({
    date: warsawToday(),
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: '',
    sourceRegister: getDefaultCashRegister(referenceData),
    targetRegister: '',
    investment: investmentFromUrl,
    worker: '',
    settled: false,
    lineItems: [makeLineItem({ expenseCategory: defaultExpenseCategory })],
  }))

  const initialValues = prefill
    ? prefill.values
    : storedValues
      ? {
          ...storedValues,
          investment: storedValues.investment || investmentFromUrl,
          type: restorableType(storedValues.type),
        }
      : blankValues

  const form = useAppForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: bulkExpenseFormSchema,
    },
    listeners: {
      // The store holds ONE draft: a prefilled form writing it would wipe the half-typed
      // „Nowy wydatek" waiting there.
      onChange: ({ formApi }) => {
        if (!prefill) updateFormData(formId, formApi.state.values as FormValuesT)
      },
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      // Backstop to the disabled submit button (a keyboard Enter can bypass it).
      if (isIngesting) {
        toastMessage('Poczekaj na przetworzenie plików.', 'warning', 4000)
        return false
      }
      if (isSaveBlocked || isParagonMode) return false

      const files = positionalFiles(value.lineItems, getFiles())

      const missingInvoice =
        isInvestmentExpense(value.type) && missingInvoiceConfirm(value.lineItems, files)
      if (missingInvoice && !(await ask(missingInvoice))) return false

      const data = toBulkData(value, value.lineItems)

      await submit(!!keepOpen, {
        action: () =>
          submitWithUploadRows(
            value.lineItems.length,
            files,
            (invoicePageRows) =>
              createBulkTransferAction(
                data,
                invoicePageRows,
                prefill && {
                  expenseDraftId: prefill.expenseDraftId,
                  ...receiptDecision(draftReceipts.receipts, value.lineItems, duplicateOfByItemId),
                },
              ),
            draftMediaIdOf,
          ),
        // No stored draft backs this form, so an optimistic close would lose it on a failed save.
        awaitBeforeClose: !!prefill,
        successMessage: 'Transakcje dodane',
        files,
        onSubmitSuccess,
        onReset: () => {
          handleReset()
          if (keepOpen)
            form.setFieldValue('date', value.date, { dontUpdateMeta: true, dontRunListeners: true })
        },
      })

      return false
    },
  })

  useCheckFormErrors(form)

  const {
    generateFromReceipts,
    regenerateRow,
    isGenerating,
    generatingIds,
    failedIds,
    generationProgress,
    resetGeneration,
  } = useReceiptGeneration({
    form,
    otherCategories: referenceData.otherCategories,
    getFiles,
    // A renamed zgłoszenie photo is a new File, which would upload again instead of linking.
    renameFile: prefill ? () => {} : renameFile,
  })

  const handleGenerate = generateFromReceipts

  const currentType = useStore(form.store, (s) => s.values.type)
  const currentInvestment = useStore(form.store, (s) => s.values.investment)
  const lineItems = useStore(form.store, (s) => s.values.lineItems)

  const { draftReceipts, receiptGrouping, rejectRows } = useParagonDecisions({
    prefill,
    isParagonMode,
    form,
    lineItems,
    replaceRows,
    isBusy: isGenerating || isIngesting || isPrefillReading,
    isAcceptBlocked: (id) => isSaveBlocked && !getRowFiles(id)?.length,
    isRegroupBlocked: isSaveBlocked,
    getFiles,
    ask,
    submit,
    linkedMediaIdOf: draftMediaIdOf,
    onSubmitSuccess,
    onDecided,
  })

  const sumAmounts = (items: typeof lineItems) =>
    items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const total = sumAmounts(
    lineItems.filter((item) => !isParagonMode || draftReceipts.pendingIds.has(item.id)),
  )

  function markDuplicate(itemId: string, duplicateOf: DuplicateOfT) {
    const index = lineItems.findIndex((item) => item.id === itemId)
    if (index === -1) return
    if (isParagonMode) {
      void rejectRows([itemId], duplicateOf)
      return
    }
    if (lineItems.length === 1) {
      onRemoveLastItem?.(duplicateOf)
      return
    }
    handleRemoveLineItem(itemId, index, (i) => form.removeFieldValue('lineItems', i))
    setDuplicateOfByItemId((prev) => new Map(prev).set(itemId, duplicateOf))
  }

  function paragonOfReadRow(
    readRow: number,
    positionOf: (itemId: string) => number | undefined,
  ): ParagonRowT | undefined {
    const itemId = draftReceipts.itemIdOfReadRow(readRow)
    if (itemId === undefined) return undefined
    const position = positionOf(itemId)
    if (position === undefined) return undefined
    return { itemId, position, status: receiptGrouping?.statusOf(itemId) ?? 'pending' }
  }

  // Top-level fields ONLY: the rows, their queued invoice files and the per-row scan markers all
  // survive a type change.
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
    resetRegisterBalance()
  }

  return (
    <FormShell form={form} onReset={handleReset}>
      <fieldset disabled={isPrefillReading} className="min-w-0">
        <FieldGroup>
          <div className="space-y-1.5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <form.AppField
                name="type"
                listeners={{ onChange: ({ value }) => resetConditionalFields(value) }}
              >
                {(field) => (
                  <field.Select label="Typ wydatku" showError fieldClassName="min-w-0 flex-1">
                    {TRANSACTION_TRANSFER_TYPES.filter((t) =>
                      canBookTransferType(referenceData.currentUserRole, t),
                    ).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TRANSFER_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </field.Select>
                )}
              </form.AppField>
              <DateField form={form} fieldClassName="w-full sm:w-40" />
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
              fixedFilter={isOfferedForBooking}
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

          {aboveLineItems}

          {!isDepositType(currentType) && (
            <LineItemsField
              form={form}
              total={isParagonMode ? undefined : total}
              hasInvestment={!!currentInvestment}
              onRemoveItem={handleRemoveLineItem}
              onRemoveLastItem={onRemoveLastItem}
              onFileChange={attachFile}
              onRemoveFile={removeFileAt}
              onRegisterFiles={registerFiles}
              getRowFiles={getRowFiles}
              onGenerate={handleGenerate}
              onGenerateRow={regenerateRow}
              isGenerating={isGenerating || isPrefillReading}
              generatingIds={generatingIds}
              ingestingIds={ingestingIds}
              failedIds={failedIds}
              receiptGrouping={receiptGrouping}
              hiddenStatuses={isParagonMode ? hiddenStatuses : undefined}
              wrapRow={
                wrapLineItem &&
                ((itemId, renderRow, positionOf) =>
                  wrapLineItem({
                    itemId,
                    markDuplicate,
                    paragonOfReadRow: (readRow) => paragonOfReadRow(readRow, positionOf),
                    disabled: receiptGrouping?.disabled ?? false,
                    renderRow,
                  }))
              }
              generationProgress={generationProgress}
              transferType={currentType}
              referenceData={referenceData}
              defaultExpenseCategory={defaultExpenseCategory}
            />
          )}
        </FieldGroup>
      </fieldset>

      {registerBalance !== null && (
        <RegisterBalanceSummary registerBalance={registerBalance} total={total} />
      )}

      {isParagonMode && receiptGrouping ? (
        <ParagonFooter
          progress={draftReceipts.progress}
          hiddenStatuses={hiddenStatuses}
          onHiddenStatusesChange={setHiddenStatuses}
          grouping={receiptGrouping}
          lineItems={lineItems}
        />
      ) : (
        <div className="mt-6">
          <FormFooter
            label="Zapisz"
            disabled={isIngesting || isPrefillReading || isSaveBlocked}
            awaitingAnswer={missingInvoiceDialog.open}
            secondaryAction={secondaryAction}
          />
        </div>
      )}
      <ConfirmDialog {...missingInvoiceDialog} />
    </FormShell>
  )
}
