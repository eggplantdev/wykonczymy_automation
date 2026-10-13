'use client'

import { useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldDescription, FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useInvoiceIngest } from '@/components/forms/expense-form/use-invoice-ingest'
import { useReceiptGeneration } from '@/components/forms/expense-form/use-receipt-generation'
import { isReceiptOf, useDraftReceipts } from '@/components/forms/expense-form/use-draft-receipts'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { useSubmitConfirm } from '@/components/forms/hooks/use-submit-confirm'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Label } from '@/components/ui/label'
import { Description } from '@/components/ui/description'
import { formatPLN } from '@/lib/utils/format-currency'
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
import { positionalFiles } from '@/components/forms/expense-form/row-file-positions'
import { submitWithUploadRows } from '@/lib/media/submit-with-uploads'
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
import { warsawToday } from '@/lib/utils/days'
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
import { canBookTransferType } from '@/lib/auth/roles'
import { receiptDecision, type DraftReceiptT } from '@/lib/worker-expenses/receipt-decision'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import type { ExpenseDraftReadRowT } from '@/lib/db/expense-draft-read'
import type { RejectedReceiptT } from '@/lib/db/worker-expense-drafts'
import {
  rejectExpenseParagonsAction,
  restoreSkippedReceiptAction,
} from '@/lib/actions/worker-expense-drafts'
import { settleAction } from '@/lib/utils/settle-action'
import { DraftProgressBadge } from '@/components/worker-expenses/draft-progress-badge'
import type { LineItemStatusT } from '@/components/forms/form-fields/collapsible-line-item'
import { cn } from '@/lib/utils/cn'
import { ReceiptSelectionActions } from '@/components/forms/expense-form/receipt-selection-actions'

// Form state uses strings since HTML inputs/selects work with strings.
// Numeric conversion happens in the server action.
type FormValuesT = BulkExpenseFormValuesT

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
  // The prefill's read is still in flight; the form locks so the refill can't overwrite typing.
  isPrefillReading?: boolean
  // The save uploads the prefill's files as the expense's invoices; without them it would book one
  // with none.
  isSaveBlocked?: boolean
  secondaryAction?: React.ReactNode
  // After each paragon booked or refused, while the dialog stays open.
  onDecided?: () => void
  // `duplicateOf` when the last row went as a duplicate — it takes the whole zgłoszenie with it.
  onRemoveLastItem?: (duplicateOf?: DuplicateOfT) => void
  // Reads the live rows, so a hint follows the row it is about as rows are removed.
  renderAboveLineItems?: (api: {
    lineItemIds: string[]
    markDuplicate: (itemId: string, duplicateOf: DuplicateOfT) => void
    itemIdOfReadRow: (readRow: number) => string | undefined
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
  renderAboveLineItems,
  onDecided,
}: TransferFormPropsT) {
  // With an AI read, a zgłoszenie is decided paragon by paragon; without one, whole.
  const isParagonMode = !!prefill && prefill.aiReadRows.length > 0
  const [rejected, setRejected] = useState(() => prefill?.rejectedReceipts ?? [])
  const [isDeciding, setIsDeciding] = useState(false)
  const [hiddenStatuses, setHiddenStatuses] = useState<ReadonlySet<LineItemStatusT>>(
    () => new Set(['accepted', 'rejected']),
  )
  const { recoveredFiles, submit } = useFormSubmit(formId)
  const { ask, dialogProps: missingInvoiceDialog } = useSubmitConfirm()
  // Rides on the acceptance decision; nothing is stored until the save.
  const [duplicateOfByItemId, setDuplicateOfByItemId] = useState(
    () => new Map<string, DuplicateOfT>(),
  )

  // Scoped by formId like every other draft consumer: `'expense'` is the only writer today, but the
  // day an „Edytuj wydatek" dialog shares this slot its draft would otherwise seed the create form.
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
    // Keyed by id, so surviving rows' markers/files need no shift and the reactive store
    // re-renders the removed row on its own.
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
    if (!prefill) resetFormData()
    resetRegisterBalance()
    resetInvoiceFiles()
    resetGeneration()
    setDuplicateOfByItemId(new Map())
  }

  // Fills the select only when it would otherwise be empty — a draft that already names an
  // investment keeps it, so navigating between investments never rewrites a half-filled form.
  const investmentFromUrl = useInvestmentFromUrl(referenceData.investments)

  // Held in state, not rebuilt inline: makeLineItem() mints a fresh uuid, so an inline literal
  // handed to useAppForm was a new defaultValues on every render — the form re-applied it, which
  // re-rendered, which minted another id → "Maximum update depth exceeded" the moment the dialog opened.
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
      // The store holds ONE draft: a prefilled form writing it would wipe the half-typed
      // „Nowy wydatek" waiting there.
      onChange: ({ formApi }) => {
        if (!prefill) updateFormData(formId, formApi.state.values as FormValuesT)
      },
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
      // Each paragon is booked by its own button; an Enter in a field books nothing.
      if (isSaveBlocked || isParagonMode) return false

      // Cross the id→position seam once, here: the upload contract and the optimistic-store
      // snapshot (persisted for recovery) are both positional (mediaIds[i] ↔ lineItems[i]).
      const files = positionalFiles(value.lineItems, getFiles())

      const missingInvoice =
        isInvestmentExpense(value.type) && missingInvoiceConfirm(value.lineItems, files)
      if (missingInvoice && !(await ask(missingInvoice))) return false

      const data = toBulkData(value, value.lineItems)

      await submit(!!keepOpen, {
        // Submit is the only upload site: the AI scan sends raw bytes and persists nothing, so
        // every attached file is uploaded once here.
        action: () =>
          submitWithUploadRows(value.lineItems.length, files, (invoicePageRows) =>
            createBulkTransferAction(
              data,
              invoicePageRows,
              prefill && {
                expenseDraftId: prefill.expenseDraftId,
                ...receiptDecision(draftReceipts.receipts, value.lineItems, duplicateOfByItemId),
              },
            ),
          ),
        // No stored draft backs this form, so an optimistic close would lose it on a failed save.
        awaitBeforeClose: !!prefill,
        successMessage: 'Transakcje dodane',
        files,
        onSubmitSuccess,
        onReset: () => {
          handleReset()
          // „Nie zamykaj" books a batch of receipts, which nearly always share one day. Set apart
          // from the reset for the same reason as the line items there.
          if (keepOpen)
            form.setFieldValue('date', value.date, { dontUpdateMeta: true, dontRunListeners: true })
        },
      })

      return false
    },
  })

  useCheckFormErrors(form)

  // A decided paragon stays in the list, so the dialog closes on the last one still waiting.
  function afterDecision(decidedIds: string[]) {
    onDecided?.()
    if ([...draftReceipts.pendingIds].every((id) => decidedIds.includes(id))) onSubmitSuccess()
  }

  async function bookRows(ids: string[]) {
    if (!prefill) return
    const value = form.state.values
    const subset = value.lineItems.filter((item) => ids.includes(item.id))
    const check = bulkExpenseFormSchema.safeParse({ ...value, lineItems: subset })
    if (!check.success) {
      toastMessage(check.error.issues[0]?.message ?? 'Uzupełnij pozycję', 'warning')
      return
    }
    const files = positionalFiles(subset, getFiles())
    const missingInvoice = isInvestmentExpense(value.type) && missingInvoiceConfirm(subset, files)
    if (missingInvoice && !(await ask(missingInvoice))) return

    const data = toBulkData(value, subset)
    setIsDeciding(true)
    try {
      await submit(true, {
        action: () =>
          submitWithUploadRows(subset.length, files, (invoicePageRows) =>
            createBulkTransferAction(data, invoicePageRows, {
              expenseDraftId: prefill.expenseDraftId,
              ...receiptDecision(draftReceipts.receipts, subset),
              skippedReceipts: [],
            }),
          ),
        successMessage: subset.length === 1 ? 'Paragon przyjęty' : `Przyjęto ${subset.length}`,
        files,
        onSubmitSuccess,
        onReset: () => draftReceipts.decide(ids, 'accepted'),
        onSaved: () => afterDecision(ids),
      })
    } finally {
      setIsDeciding(false)
    }
  }

  async function rejectRows(ids: string[], duplicateOf?: DuplicateOfT) {
    if (!prefill) return
    const parts = ids.flatMap((id) => draftReceipts.receipts.get(id) ?? [])
    setIsDeciding(true)
    try {
      const result = await settleAction(() =>
        rejectExpenseParagonsAction(
          prefill.expenseDraftId,
          parts.map((part) => ({ mediaIds: part.mediaIds, readRow: part.readRow, duplicateOf })),
        ),
      )
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      toastMessage(ids.length === 1 ? 'Paragon odrzucony' : `Odrzucono ${ids.length}`)
      setRejected((prev) => [...prev, ...result.data])
      draftReceipts.decide(ids, 'rejected')
      afterDecision(ids)
    } finally {
      setIsDeciding(false)
    }
  }

  function refusalsOf(id: string) {
    const parts = draftReceipts.receipts.get(id) ?? []
    return rejected.filter((receipt) => parts.some((part) => isReceiptOf(receipt, part)))
  }

  async function undoReject(id: string) {
    const receipts = refusalsOf(id)
    setIsDeciding(true)
    try {
      for (const receipt of receipts) {
        const result = await settleAction(() => restoreSkippedReceiptAction(receipt.id))
        if (!result.success) {
          toastMessage(result.error, 'error')
          return
        }
        setRejected((prev) => prev.filter((r) => r.id !== receipt.id))
      }
      draftReceipts.undecide(id)
      onDecided?.()
    } finally {
      setIsDeciding(false)
    }
  }

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
    renameFile,
  })

  // The reactive file store re-renders each FV label as generateFromReceipts renames its file — no
  // remount needed, so this is just the scan.
  const handleGenerate = generateFromReceipts

  const currentType = useStore(form.store, (s) => s.values.type)
  const currentInvestment = useStore(form.store, (s) => s.values.investment)
  const lineItems = useStore(form.store, (s) => s.values.lineItems)

  const draftReceipts = useDraftReceipts({
    source: prefill,
    lineItems,
    setLineItems: (items) => form.setFieldValue('lineItems', items),
    replaceRows,
    isBusy: isGenerating || isIngesting || isPrefillReading || isDeciding,
  })

  const receiptGrouping = draftReceipts.grouping && {
    ...draftReceipts.grouping,
    onDecide: isParagonMode
      ? (ids: string[], decision: 'accept' | 'reject') =>
          decision === 'accept' ? bookRows(ids) : rejectRows(ids)
      : undefined,
    // A photo refused without a read has no row the restore can name.
    undoFor: (id: string) => {
      const receipts = refusalsOf(id)
      return receipts.length > 0 && receipts.every((receipt) => receipt.readRow !== null)
        ? () => void undoReject(id)
        : undefined
    },
  }
  // Booked and refused rows stay on screen; only what is still waiting adds up.
  const sumAmounts = (items: typeof lineItems) =>
    items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const total = sumAmounts(
    lineItems.filter((item) => !isParagonMode || draftReceipts.pendingIds.has(item.id)),
  )
  const selectedIds = receiptGrouping?.selectedIds ?? new Set<string>()
  const selectedTotal = sumAmounts(lineItems.filter((item) => selectedIds.has(item.id)))

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
      <fieldset disabled={isPrefillReading} className="min-w-0">
        <FieldGroup>
          {/* The netto hint sits UNDER the row, not on the Select as a `description` — FormBase
          renders a description between the label and the control, which would push the type
          Select down while „Data" beside it stayed put, breaking the row's alignment. */}
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

          {renderAboveLineItems?.({
            lineItemIds: lineItems
              .map((item) => item.id)
              .filter((id) => draftReceipts.pendingIds.has(id)),
            markDuplicate,
            itemIdOfReadRow: draftReceipts.itemIdOfReadRow,
          })}

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

      {/* Pinned while deciding: a zgłoszenie runs to dozens of paragony, and the selection's actions
      must stay in reach from any of them. Negative offsets cancel the dialog's own padding. */}
      <div
        className={cn(
          'mt-6',
          isParagonMode &&
            'bg-background sticky -bottom-4 z-10 -mx-4 -mb-4 space-y-3 px-4 pt-3 pb-4 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6',
        )}
      >
        {isParagonMode && prefill && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="space-y-2">
              <DraftProgressBadge
                progress={draftReceipts.progress}
                hidden={hiddenStatuses}
                onToggle={(status) =>
                  setHiddenStatuses((prev) => {
                    const next = new Set(prev)
                    if (!next.delete(status)) next.add(status)
                    return next
                  })
                }
              />
              <Description size="xs">
                Kliknij etykietę, aby ukryć lub pokazać te paragony.
              </Description>
            </div>
            <div className="ml-auto flex flex-col items-end gap-2">
              {selectedIds.size > 0 && (
                <Label>
                  Suma zaznaczonych ({selectedIds.size}): {formatPLN(selectedTotal)}
                </Label>
              )}
              {receiptGrouping && <ReceiptSelectionActions grouping={receiptGrouping} />}
            </div>
          </div>
        )}
        {!isParagonMode && (
          <FormFooter
            label="Zapisz"
            disabled={isIngesting || isPrefillReading || isSaveBlocked || isDeciding}
            awaitingAnswer={missingInvoiceDialog.open}
            secondaryAction={secondaryAction}
          />
        )}
      </div>
      <ConfirmDialog {...missingInvoiceDialog} />
    </FormShell>
  )
}

function toBulkData(
  value: FormValuesT,
  lineItems: FormValuesT['lineItems'],
): CreateBulkExpenseFormT {
  const type = value.type as TransferTypeT
  return {
    date: value.date,
    type,
    paymentMethod: (value.paymentMethod as PaymentMethodT) || null,
    sourceRegister: value.sourceRegister ? Number(value.sourceRegister) : undefined,
    targetRegister: value.targetRegister ? Number(value.targetRegister) : undefined,
    investment: value.investment ? Number(value.investment) : undefined,
    worker: value.worker ? Number(value.worker) : undefined,
    settled: value.settled,
    lineItems: lineItems.map((item) => mapLineItem(item, type, !!value.investment)),
  }
}
