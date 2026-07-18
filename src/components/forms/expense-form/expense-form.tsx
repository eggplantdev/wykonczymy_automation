'use client'

import { useState } from 'react'
import { SelectItem } from '@/components/ui/select'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { useInvoiceFiles, type IngestResultT } from '@/components/forms/hooks/use-invoice-files'
import { useReceiptGeneration } from '@/components/forms/hooks/use-receipt-generation'
import { useFormSubmit } from '@/components/forms/hooks/use-form-submit'
import { useSaldo } from '@/components/forms/hooks/use-saldo'
import { SubmitPill } from '@/components/forms/submit-pill'
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
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import {
  filesByRowId,
  positionalFiles,
  resolveInvoiceMediaIds,
} from '@/lib/utils/upload-file-client'
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

  // Rows whose picked file is still being processed at ingest (HEIC convert can take ~1-2 s). The
  // row shows a spinner and its actions are disabled meanwhile, and a batch scan waits for ingest
  // before running the AI generation. Keyed on each row's stable id (EX-448).
  const [ingestingIds, setIngestingIds] = useState<Set<string>>(new Set())

  function markIngesting(ids: string[], busy: boolean) {
    setIngestingIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (busy ? next.add(id) : next.delete(id)))
      return next
    })
  }

  const isIngesting = ingestingIds.size > 0

  function reportBlocked(blocked: BlockedFileError[]) {
    if (blocked.length === 0) return
    // TODO(EX-449) SENTRY-REQUIRED: blocked-file ingest failures (unconvertible HEIC / oversize)
    // must be captured once Sentry is wired — currently surfaced only as a per-item user toast.
    toastMessage(blockedFilesMessage(blocked), 'error', 8000)
  }

  // recoveredFiles is the previous submit's positional Map<number,File> (wire order). Re-key it to
  // id-space against the recovered rows (same order) so the restored form stays id-keyed — ids
  // survive the submit→fail→restore round-trip via storedValues.
  const recoveredFilesById =
    recoveredFiles && storedValues?.lineItems
      ? filesByRowId(storedValues.lineItems, recoveredFiles)
      : undefined

  const {
    handleRemoveLineItem,
    handleFileChange,
    registerFilesAt,
    getFile,
    getFiles,
    renameFile,
    reset: resetInvoiceFiles,
  } = useInvoiceFiles(recoveredFilesById)

  // Run one ingest batch: mark the rows busy, report any blocked files, and — crucially — always
  // clear the spinner in `finally`. The finally is load-bearing: an unexpected ingest rejection
  // (e.g. a chunk-load failure on the lazy import) must still release the rows, or they stay busy
  // forever and wedge the whole form. Blocked files enter no map; the row stays empty. The reactive
  // file store re-renders attached rows (input → thumbnail) on its own — no remount key.
  async function runIngest(ids: string[], ingest: () => Promise<IngestResultT>) {
    markIngesting(ids, true)
    try {
      reportBlocked((await ingest()).blocked)
    } catch {
      // TODO(EX-449) SENTRY-REQUIRED: unexpected ingest failure (not a BlockedFileError) — capture
      // once Sentry is wired; for now the user gets a generic retry toast.
      toastMessage('Nie udało się przetworzyć pliku — spróbuj ponownie.', 'error', 6000)
    } finally {
      markIngesting(ids, false)
    }
  }

  function handleRegisterFiles(ids: string[], files: File[]) {
    return runIngest(ids, () => registerFilesAt(ids, files))
  }

  function handleAttachFile(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    return runIngest([id], () => handleFileChange(id, e))
  }

  // Drop the row's out-of-form file by id; the id keying means surviving rows' markers/files need
  // no shift, and the reactive store re-renders the removed row on its own.
  function handleRemove(id: string, index: number, removeValue: (index: number) => void) {
    handleRemoveLineItem(id, index, removeValue)
  }

  // FormClearButton runs form.reset() (restores the mount-time default, whose row id is stale) and
  // then this. Mint a fresh-id blank row so its React key changes and the row — with its uncontrolled
  // FileInput — remounts, clearing any native FileList that form.reset() can't reach.
  function handleReset() {
    resetFormData()
    resetSaldo()
    resetInvoiceFiles()
    resetGeneration()
    form.setFieldValue('lineItems', [makeLineItem()])
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
        lineItems: [makeLineItem()],
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

      // Cross the id→position seam once, here: the upload contract and the optimistic-store
      // snapshot (persisted for recovery) are both positional (mediaIds[i] ↔ lineItems[i]).
      const files = positionalFiles(value.lineItems, getFiles())

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

  // TanStack Form preserves values of unmounted fields. When the user switches
  // transfer type, hidden fields (e.g. investment) keep stale selections.
  // Reset them so validation and submission use a clean slate for the new type.
  const conditionalFields = ['targetRegister', 'investment', 'worker', 'settled'] as const

  function resetConditionalFields() {
    conditionalFields.forEach((field) => form.resetField(field))
    form.resetField('sourceRegister')
    // resetField('lineItems') would restore the stale-id mount default; set a fresh-id blank row
    // instead so the row (and its uncontrolled FileInput) remounts. The queued files live outside
    // the form, so clear them too — otherwise a file queued before the type switch attaches to the
    // wrong/nonexistent line item on submit.
    form.setFieldValue('lineItems', [makeLineItem()])
    resetInvoiceFiles()
    resetGeneration()
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
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            generatingIds={generatingIds}
            ingestingIds={ingestingIds}
            failedIds={failedIds}
            generationProgress={generationProgress}
            transferType={currentType}
            referenceData={referenceData}
          />
        )}
      </FieldGroup>

      {saldo !== null && <SaldoSummary saldo={saldo} total={total} />}

      {isGenerating && <SubmitPill label="Odczytywanie paragonów…" />}

      <FormFooter className="mt-6" label="Zapisz" disabled={isIngesting} />
    </FormShell>
  )
}
