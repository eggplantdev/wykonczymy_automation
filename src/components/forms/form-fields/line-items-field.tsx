'use client'

import { Fragment, useRef, useState } from 'react'
import { Trash2, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { RemoveButton } from '@/components/ui/remove-button'
import { LineItemInvoiceField } from '@/components/forms/form-fields/line-item-invoice-field'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  EXPENSE_CATEGORY_LABEL,
  needsExpenseCategory,
  showsOtherCategory,
} from '@/lib/constants/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'
import type {
  BulkExpenseFormApiT,
  BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'

// The TanStack array-field API this component drives (`form.Field name="lineItems" mode="array"`).
// Structural on purpose — same convention as AppFieldComponentsT: name only the members we call,
// since the full FieldApi generic is unnameable and the real inferred field is assignable to this.
type LineItemsArrayFieldT = {
  state: { value: BulkExpenseFormValuesT['lineItems'] }
  pushValue: (value: BulkExpenseFormValuesT['lineItems'][number]) => void
  removeValue: (index: number) => void
}

type CategoryFieldConfigT = {
  fieldName: 'category' | 'expenseCategory'
  label: string
  placeholder: string
  options: { id: number; name: string }[]
}

// Mirrors the receipt picker's accept="image/*,application/pdf" for dropped files, which carry no filter.
const isReceiptFile = (file: File) =>
  file.type.startsWith('image/') || file.type === 'application/pdf'

const EMPTY_LINE_ITEM: BulkExpenseFormValuesT['lineItems'][number] = {
  description: '',
  amount: '',
  invoiceNote: '',
  category: '',
  expenseCategory: '',
}

type LineItemsFieldPropsT = {
  form: BulkExpenseFormApiT
  transferType: string
  referenceData: ReferenceDataBaseT
  defaultExpenseCategory?: string
  total: number
  hasInvestment?: boolean
  onRemoveItem: (index: number, removeValue: (index: number) => void) => void
  onFileChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void
  // Batch-attach N receipt images: register each file at its row index (see use-invoice-files).
  // Async (ingest processing) — awaited before generation so the files map is populated first.
  onRegisterFiles: (startIndex: number, files: File[]) => Promise<void>
  // Read a row's attached file so it can render a thumbnail preview (undefined → file input).
  getFile: (index: number) => File | undefined
  // Bump to force-remount the uncontrolled file inputs (clears their selection).
  fileInputKey?: number
  // Receipt generation: scan every eligible row's image and populate its fields (see use-receipt-generation).
  onGenerate?: () => void
  isGenerating?: boolean
  generatingIndices?: Set<number>
  // Rows whose picked file is still being processed at ingest — show a spinner, disable actions.
  ingestingIndices?: Set<number>
  failedIndices?: Set<number>
  generationProgress?: { done: number; total: number } | null
}

const otherCategoryConfig = (refData: ReferenceDataBaseT): CategoryFieldConfigT => ({
  fieldName: 'category',
  label: 'Kategoria',
  placeholder: 'Opcjonalnie',
  options: refData.otherCategories,
})

function getInlineCategory(
  type: string,
  refData: ReferenceDataBaseT,
  hasInvestment?: boolean,
): CategoryFieldConfigT | undefined {
  if (needsExpenseCategory(type, hasInvestment)) {
    return {
      fieldName: 'expenseCategory',
      label: EXPENSE_CATEGORY_LABEL,
      placeholder: `${EXPENSE_CATEGORY_LABEL} *`,
      options: refData.expenseCategories,
    }
  }
  if (showsOtherCategory(type)) return otherCategoryConfig(refData)
  return undefined
}

function getSecondRowCategory(
  type: string,
  refData: ReferenceDataBaseT,
): CategoryFieldConfigT | undefined {
  // Show other category in second row when inline is already taken by expense category
  if (needsExpenseCategory(type) && showsOtherCategory(type)) return otherCategoryConfig(refData)
  return undefined
}

function CategorySelect({
  form,
  index,
  config,
  fieldClassName,
}: {
  form: BulkExpenseFormApiT
  index: number
  config: CategoryFieldConfigT
  fieldClassName?: string
}) {
  return (
    <form.AppField name={`lineItems[${index}].${config.fieldName}`}>
      {(field: AppFieldComponentsT) => (
        <field.Combobox
          label={config.label}
          placeholder={config.placeholder}
          searchPlaceholder={`Szukaj: ${config.label.toLowerCase()}...`}
          emptyMessage="Nie znaleziono."
          items={config.options.map((opt) => ({ value: String(opt.id), label: opt.name }))}
          // No error text — the red aria-invalid border is signal enough, and the message
          // reflowed the row (pushing sibling fields down). Border stays; message dropped.
          fieldClassName={fieldClassName}
        />
      )}
    </form.AppField>
  )
}

export function LineItemsField({
  form,
  transferType,
  referenceData,
  defaultExpenseCategory = '',
  total,
  hasInvestment,
  onRemoveItem,
  onFileChange,
  onRegisterFiles,
  getFile,
  fileInputKey = 0,
  onGenerate,
  isGenerating = false,
  generatingIndices,
  ingestingIndices,
  failedIndices,
  generationProgress,
}: LineItemsFieldPropsT) {
  const inlineCategory = getInlineCategory(transferType, referenceData, hasInvestment)
  const secondRowCategory = getSecondRowCategory(transferType, referenceData)
  const emptyItem = defaultExpenseCategory
    ? { ...EMPTY_LINE_ITEM, expenseCategory: defaultExpenseCategory }
    : EMPTY_LINE_ITEM
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const isIngesting = (ingestingIndices?.size ?? 0) > 0
  const [isDragOver, setIsDragOver] = useState(false)

  // Scan flow: add each picked receipt as a row (image attached) FIRST, then run the AI generation.
  // Order matters — rows persist even if extraction fails, so a failed scan still yields line
  // items to fill in by hand. Ingest is async (HEIC-convert / compress / guard), so AWAIT it before
  // generation — otherwise generation reads an empty files map. Empty picked list → skip the add
  // and just re-run generation on any existing eligible rows (picker cancelled).
  async function scanReceipts(picked: File[], lineItemsField: LineItemsArrayFieldT) {
    if (picked.length > 0) {
      // Reuse the lone initial blank row for the first image so the first receipt lands on
      // row 0 rather than after an empty row; otherwise append after the existing rows.
      const rows = lineItemsField.state.value
      const reuseFirstRow = rows.length === 1 && !rows[0].description && !rows[0].amount
      const startIndex = reuseFirstRow ? 0 : rows.length
      const rowsToPush = reuseFirstRow ? picked.length - 1 : picked.length

      for (let i = 0; i < rowsToPush; i++) lineItemsField.pushValue(emptyItem)
      await onRegisterFiles(startIndex, picked)
    }
    onGenerate?.()
  }

  function handleScanReceipts(
    e: React.ChangeEvent<HTMLInputElement>,
    lineItemsField: LineItemsArrayFieldT,
  ) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-picking the same files after a reset
    return scanReceipts(picked, lineItemsField)
  }

  // Drop mirrors the picker but drops carry no `accept` filter, so keep only receipt files and bail
  // on an empty result — unlike the picker, an unmatched drop must NOT re-run generation on existing rows.
  function handleDropReceipts(e: React.DragEvent, lineItemsField: LineItemsArrayFieldT) {
    e.preventDefault()
    setIsDragOver(false)
    if (isGenerating || isIngesting) return
    const picked = Array.from(e.dataTransfer.files).filter(isReceiptFile)
    if (picked.length === 0) return
    return scanReceipts(picked, lineItemsField)
  }

  return (
    <form.Field name="lineItems" mode="array">
      {(lineItemsField: LineItemsArrayFieldT) => (
        <div className="space-y-4">
          <div className="space-y-6">
            {lineItemsField.state.value.map((_: unknown, index: number) => (
              <Fragment key={index}>
                <div className="space-y-2">
                  <div className="flex items-end gap-2">
                    <form.AppField name={`lineItems[${index}].amount`}>
                      {(field: AppFieldComponentsT) => (
                        <field.Input
                          label="Kwota"
                          placeholder="0.00 PLN"
                          type="number"
                          showError
                          fieldClassName="w-28"
                        />
                      )}
                    </form.AppField>
                    <form.AppField name={`lineItems[${index}].description`}>
                      {(field: AppFieldComponentsT) => (
                        <field.Input
                          label="Opis"
                          placeholder="Opcjonalnie"
                          showError
                          fieldClassName="min-w-0 flex-1"
                        />
                      )}
                    </form.AppField>
                    {inlineCategory && (
                      <CategorySelect
                        form={form}
                        index={index}
                        config={inlineCategory}
                        fieldClassName="min-w-0 flex-1"
                      />
                    )}
                    {failedIndices?.has(index) && (
                      <span className="text-destructive mb-2 shrink-0 text-xs whitespace-nowrap">
                        nie odczytano
                      </span>
                    )}
                    {/* Delete lives in row 1, its height matching the inputs; the row being read
                      shows the loader in its slot and queued rows keep it disabled — removing a
                      row mid-generation shifts the array under in-flight extraction tasks (captured
                      index), landing a result on the wrong row. */}
                    <div className="flex size-9 shrink-0 items-center justify-center">
                      {generatingIndices?.has(index) || ingestingIndices?.has(index) ? (
                        <GradientSpinner />
                      ) : (
                        <RemoveButton
                          icon={Trash2}
                          onClick={() => onRemoveItem(index, lineItemsField.removeValue)}
                          disabled={
                            isGenerating || isIngesting || lineItemsField.state.value.length === 1
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    {secondRowCategory && (
                      <CategorySelect
                        form={form}
                        index={index}
                        config={secondRowCategory}
                        fieldClassName="min-w-0 flex-1"
                      />
                    )}
                    <LineItemInvoiceField
                      index={index}
                      file={getFile(index)}
                      fieldClassName="min-w-0 flex-1"
                      fileInputKey={fileInputKey}
                      onFileChange={onFileChange}
                    />
                  </div>
                  <form.AppField name={`lineItems[${index}].invoiceNote`}>
                    {(field: AppFieldComponentsT) => (
                      <field.Textarea
                        label="Notatka"
                        placeholder="Opcjonalnie"
                        rows={2}
                        showError
                        fieldClassName="w-full"
                        // A long scanned note (30+ item invoices) would grow the
                        // field-sizing-content textarea unbounded — cap it and scroll within.
                        className="max-h-24 overflow-y-auto"
                      />
                    )}
                  </form.AppField>
                </div>
                {index < lineItemsField.state.value.length - 1 && (
                  <Separator orientation="horizontal" className="bg-foreground" />
                )}
              </Fragment>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => lineItemsField.pushValue(emptyItem)}
            >
              Dodaj pozycję
            </Button>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="sr-only"
              onChange={(e) => handleScanReceipts(e, lineItemsField)}
            />
            {onGenerate && (
              <Button
                type="button"
                variant="ai"
                size="sm"
                onClick={() => receiptInputRef.current?.click()}
                disabled={isGenerating || isIngesting}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragOver(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setIsDragOver(false)
                }}
                onDrop={(e) => handleDropReceipts(e, lineItemsField)}
                className={cn(isDragOver && 'ring-neon-cyan ring-2')}
              >
                {isGenerating || isIngesting ? (
                  <GradientSpinner />
                ) : (
                  <WandSparkles className="text-neon-cyan" />
                )}
                <span className="text-neon-cyan font-semibold">Dodaj paragony</span>
              </Button>
            )}
            {generationProgress && (
              <span className="text-muted-foreground self-center text-sm">
                Odczytano {generationProgress.done}/{generationProgress.total}
              </span>
            )}
          </div>
          <Label>Suma: {formatPLN(total)}</Label>
        </div>
      )}
    </form.Field>
  )
}
