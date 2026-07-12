'use client'

import { useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useInvoiceFiles, type IngestResultT } from '@/components/forms/hooks/use-invoice-files'
import { useReceiptGeneration } from '@/components/forms/hooks/use-receipt-generation'
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
  canBeSettled,
  type TransferTypeT,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { createBulkTransferAction } from '@/lib/actions/transfers'
import { mapLineItem } from '@/components/forms/expense-form/map-line-item'
import type { BulkExpenseFormValuesT } from '@/components/forms/expense-form/bulk-expense-form'
import { resolveInvoiceMediaIds } from '@/lib/utils/upload-file-client'
import { MAX_UPLOAD_BYTES, type BlockedFileError } from '@/lib/utils/process-upload-file'
import { toastMessage } from '@/lib/utils/toast'
import {
  bulkExpenseFormSchema,
  type CreateBulkExpenseFormT,
} from '@/components/forms/expense-form/expense-schema'
import type { ReferenceDataT } from '@/types/reference-data'
import { today } from '@/lib/utils/date'
import {
  CashRegisterField,
  DateField,
  EntityComboboxField,
  SourceRegisterField,
  LineItemsField,
} from '@/components/forms/form-fields'
import useCheckFormErrors from '../hooks/use-check-form-errors'
import FormFooter from '../form-components/form-footer'
import { FormShell } from '../form-components/form-shell'
import { SaldoSummary } from '../form-components/saldo-summary'
import { useExpenseFormStore } from '@/stores/form-stores'

type TransferFormPropsT = {
  referenceData: ReferenceDataT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

// Form state uses strings since HTML inputs/selects work with strings.
// Numeric conversion happens in the server action.
type FormValuesT = BulkExpenseFormValuesT

const FORM_ID = 'expense'

const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024)

// One Polish line per blocked file (unconvertible HEIC / oversize) in a single toast so one bad
// file in a batch never spams N toasts. Rendered as JSX rather than a "\n"-joined string because
// react-toastify collapses newlines in HTML — a multi-file block would otherwise run together. The
// MB figure tracks MAX_UPLOAD_BYTES (the guard), not the raw 4.5 MB Vercel cap.
function blockedFilesMessage(blocked: BlockedFileError[]) {
  return (
    <div>
      {blocked.map((error, index) => (
        <p key={index}>
          {error.reason === 'too-large'
            ? `Plik „${error.filename}” przekracza ${MAX_UPLOAD_MB} MB — zmniejsz go i spróbuj ponownie.`
            : `Nie udało się przekonwertować „${error.filename}” — zapisz jako JPG i spróbuj ponownie.`}
        </p>
      ))}
    </div>
  )
}

export function ExpenseForm({ referenceData, onSubmitSuccess, keepOpen }: TransferFormPropsT) {
  const { recoveredFiles, submit } = useFormSubmit(FORM_ID)

  const storedValues = useExpenseFormStore((s) => s.formData)
  const updateFormData = useExpenseFormStore((s) => s.updateFormData)
  const resetFormData = useExpenseFormStore((s) => s.resetFormData)

  const { saldo, isSaldoLoading, fetchSaldo, resetSaldo } = useSaldo()

  // Bumped on reset to remount the (uncontrolled) file inputs, clearing their
  // native files and internal filename state — form.reset() can't reach them.
  const [fileInputKey, setFileInputKey] = useState(0)

  // Rows whose picked file is still being processed at ingest (HEIC convert can take ~1-2 s). The
  // row shows a spinner and its actions are disabled meanwhile, and a batch scan waits for ingest
  // before running the AI generation.
  const [ingestingIndices, setIngestingIndices] = useState<Set<number>>(new Set())

  function markIngesting(indices: number[], busy: boolean) {
    setIngestingIndices((prev) => {
      const next = new Set(prev)
      indices.forEach((index) => (busy ? next.add(index) : next.delete(index)))
      return next
    })
  }

  const isIngesting = ingestingIndices.size > 0

  function reportBlocked(blocked: BlockedFileError[]) {
    if (blocked.length === 0) return
    // TODO(EX-449) SENTRY-REQUIRED: blocked-file ingest failures (unconvertible HEIC / oversize)
    // must be captured once Sentry is wired — currently surfaced only as a per-item user toast.
    toastMessage(blockedFilesMessage(blocked), 'error', 8000)
  }

  const {
    handleRemoveLineItem,
    handleFileChange,
    registerFilesAt,
    getFile,
    getFiles,
    renameFile,
    reset: resetInvoiceFiles,
  } = useInvoiceFiles(recoveredFiles)

  // Run one ingest batch: mark the rows busy, report any blocked files, and — crucially — always
  // clear the spinner and bump the key in `finally`. The finally is load-bearing: an unexpected
  // ingest rejection (e.g. a chunk-load failure on the lazy import) must still release the rows, or
  // they stay busy forever and wedge the whole form. Blocked files enter no map; the row stays empty.
  async function runIngest(indices: number[], ingest: () => Promise<IngestResultT>) {
    markIngesting(indices, true)
    try {
      reportBlocked((await ingest()).blocked)
    } catch {
      // TODO(EX-449) SENTRY-REQUIRED: unexpected ingest failure (not a BlockedFileError) — capture
      // once Sentry is wired; for now the user gets a generic retry toast.
      toastMessage('Nie udało się przetworzyć pliku — spróbuj ponownie.', 'error', 6000)
    } finally {
      markIngesting(indices, false)
      // Re-render the affected rows so they swap the file input for the attached-file thumbnail.
      setFileInputKey((k) => k + 1)
    }
  }

  function handleRegisterFiles(startIndex: number, files: File[]) {
    const indices = files.map((_, offset) => startIndex + offset)
    return runIngest(indices, () => registerFilesAt(startIndex, files))
  }

  function handleAttachFile(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    return runIngest([index], () => handleFileChange(index, e))
  }

  // Re-align the generation markers (failed/in-flight) alongside the file maps on row removal.
  // Bump the key so surviving rows re-render and re-read their file from the reindexed ref —
  // otherwise a shifted-up row keeps showing the removed row's file input/thumbnail.
  function handleRemove(index: number, removeValue: (index: number) => void) {
    handleRemoveLineItem(index, removeValue)
    onRowRemoved(index)
    setFileInputKey((k) => k + 1)
  }

  function handleReset() {
    resetFormData()
    resetSaldo()
    resetInvoiceFiles()
    resetGeneration()
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
              // Submit is the only upload site: the AI scan sends raw bytes and persists nothing, so
              // every attached file is uploaded once here.
              invoiceMediaIds = await resolveInvoiceMediaIds(value.lineItems.length, files)
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

  const {
    generateFromReceipts,
    isGenerating,
    generatingIndices,
    failedIndices,
    generationProgress,
    onRowRemoved,
    resetGeneration,
  } = useReceiptGeneration({
    form,
    otherCategories: referenceData.otherCategories,
    getFiles,
    renameFile,
  })

  // Run the generation, then remount the uncontrolled file inputs so each re-reads its (possibly
  // renamed) filename from the ref — the labels can't update in place.
  async function handleGenerate() {
    await generateFromReceipts()
    setFileInputKey((k) => k + 1)
  }

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
    resetGeneration()
    setFileInputKey((k) => k + 1)
    resetSaldo()
  }

  return (
    <FormShell form={form} onReset={handleReset}>
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
          <EntityComboboxField form={form} variant="investment" items={referenceData.investments} />
        )}

        {canBeSettled(currentType) && (
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
            onRemoveItem={handleRemove}
            onFileChange={handleAttachFile}
            onRegisterFiles={handleRegisterFiles}
            getFile={getFile}
            fileInputKey={fileInputKey}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            generatingIndices={generatingIndices}
            ingestingIndices={ingestingIndices}
            failedIndices={failedIndices}
            generationProgress={generationProgress}
            transferType={currentType}
            referenceData={referenceData}
          />
        )}
      </FieldGroup>

      {saldo !== null && <SaldoSummary saldo={saldo} total={total} />}

      <FormFooter className="mt-6" label="Zapisz" disabled={isIngesting} />
    </FormShell>
  )
}
