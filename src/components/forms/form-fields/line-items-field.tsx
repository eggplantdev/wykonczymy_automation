'use client'

import { Fragment, useRef, useState } from 'react'
import { Trash2, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { RemoveButton } from '@/components/ui/remove-button'
import { LineItemInvoiceField } from '@/components/forms/form-fields/line-item-invoice-field'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils/cn'
import {
  FILE_DRAG_ARMED_CLASS,
  FILE_DRAG_OVER_CLASS,
  useWindowFileDrag,
} from '@/hooks/use-window-file-drag'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  billsNetAmount,
  EXPENSE_CATEGORY_LABEL,
  needsExpenseCategory,
  showsOtherCategory,
} from '@/lib/constants/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import {
  makeLineItem,
  type BulkExpenseFormApiT,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'

// The TanStack array-field API this component drives (`form.Field name="lineItems" mode="array"`).
// Structural on purpose — name only the members we call, since the full FieldApi generic is
// unnameable and the real inferred field is assignable to this.
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

// What the picked photos mean: N separate expenses, or N pages of one expense's invoice.
type ScanModeT = 'one-per-photo' | 'one-invoice'

const SCAN_MODE_OPTIONS: OptionT<ScanModeT>[] = [
  { value: 'one-per-photo', label: 'Kilka wydatków' },
  { value: 'one-invoice', label: 'Jeden wydatek' },
]

const SCAN_MODE_HINT: Record<ScanModeT, string> = {
  'one-per-photo': 'Każde zdjęcie to osobny paragon — powstanie z niego własna pozycja.',
  'one-invoice': 'Wszystkie zdjęcia to jedna faktura — powstanie jedna pozycja z kilkoma stronami.',
}

type LineItemsFieldPropsT = {
  form: BulkExpenseFormApiT
  transferType: string
  referenceData: ReferenceDataBaseT
  defaultExpenseCategory?: string
  total: number
  hasInvestment?: boolean
  onRemoveItem: (id: string, index: number, removeValue: (index: number) => void) => void
  onFileChange: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (id: string, index: number) => void
  // Batch-attach N receipt images: 'per-row' registers `files[i]` against row `ids[i]`,
  // 'single-row' hangs all of them on `ids[0]` as one multi-page invoice (see use-invoice-files).
  // Async (ingest processing) — awaited before generation so the files map is populated first.
  onRegisterFiles: (ids: string[], files: File[], mode?: 'per-row' | 'single-row') => Promise<void>
  // Read a row's attached pages so it can render a preview (empty → file input).
  getRowFiles: (id: string) => File[] | undefined
  // Receipt generation: scan every eligible row's image and populate its fields (see use-receipt-generation).
  onGenerate?: () => void
  isGenerating?: boolean
  // Marker sets key on each row's stable id (EX-448), not its position.
  generatingIds?: Set<string>
  // Rows whose picked file is still being processed at ingest — show a spinner, disable actions.
  ingestingIds?: Set<string>
  failedIds?: Set<string>
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
      {(field) => (
        <field.Combobox
          label={config.label}
          placeholder={config.placeholder}
          searchPlaceholder={`Szukaj: ${config.label.toLowerCase()}...`}
          emptyMessage="Nie znaleziono."
          items={config.options.map((opt) => ({ value: String(opt.id), label: opt.name }))}
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
  onRemoveFile,
  onRegisterFiles,
  getRowFiles,
  onGenerate,
  isGenerating = false,
  generatingIds,
  ingestingIds,
  failedIds,
  generationProgress,
}: LineItemsFieldPropsT) {
  const inlineCategory = getInlineCategory(transferType, referenceData, hasInvestment)
  const showsNetAmount = billsNetAmount(transferType)
  const secondRowCategory = getSecondRowCategory(transferType, referenceData)
  // Fresh per call — each pushed row needs its own `id` (a shared object would collide ids).
  const newItem = () =>
    makeLineItem(defaultExpenseCategory ? { expenseCategory: defaultExpenseCategory } : undefined)
  const scanInputRef = useRef<HTMLInputElement>(null)
  const isIngesting = (ingestingIds?.size ?? 0) > 0
  const isFileDragActive = useWindowFileDrag()
  const [dragOverMode, setDragOverMode] = useState<ScanModeT | null>(null)
  const [scanMode, setScanMode] = useState<ScanModeT>('one-per-photo')

  // Scan flow: add each picked receipt as a row (image attached) FIRST, then run the AI generation.
  // Order matters — rows persist even if extraction fails, so a failed scan still yields line
  // items to fill in by hand. Ingest is async (HEIC-convert / compress / guard), so AWAIT it before
  // generation — otherwise generation reads an empty files map. Empty picked list → skip the add
  // and just re-run generation on any existing eligible rows (picker cancelled).
  //
  // `mode` is the user's declared intent, taken from WHICH entry point they used: one expense per
  // photo, or one expense whose pages are all the picked photos. Nothing about the files themselves
  // can tell the two apart, so the choice has to be made before the scan runs.
  async function scanReceipts(
    picked: File[],
    lineItemsField: LineItemsArrayFieldT,
    mode: ScanModeT,
  ) {
    if (picked.length > 0) {
      // Reuse the lone initial blank row for the first image so the first receipt lands on
      // row 0 rather than after an empty row; otherwise append after the existing rows. Mint the
      // new rows up front so we know their ids (pushValue is async in the form's state) and can
      // pair each picked file to its row by id — `ids[i]` holds `picked[i]`.
      const rows = lineItemsField.state.value
      const reuseFirstRow = rows.length === 1 && !rows[0].description && !rows[0].amount
      const rowCount = mode === 'one-invoice' ? 1 : picked.length
      const newRows = Array.from({ length: reuseFirstRow ? rowCount - 1 : rowCount }, () =>
        newItem(),
      )
      for (const row of newRows) lineItemsField.pushValue(row)
      const ids = (reuseFirstRow ? [rows[0], ...newRows] : newRows).map((row) => row.id)
      await onRegisterFiles(ids, picked, mode === 'one-invoice' ? 'single-row' : 'per-row')
    }
    onGenerate?.()
  }

  function handleScanReceipts(
    e: React.ChangeEvent<HTMLInputElement>,
    lineItemsField: LineItemsArrayFieldT,
    mode: ScanModeT,
  ) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-picking the same files after a reset
    return scanReceipts(picked, lineItemsField, mode)
  }

  // Drop mirrors the picker but drops carry no `accept` filter, so keep only receipt files and bail
  // on an empty result — unlike the picker, an unmatched drop must NOT re-run generation on existing rows.
  function handleDropReceipts(
    e: React.DragEvent,
    lineItemsField: LineItemsArrayFieldT,
    mode: ScanModeT,
  ) {
    e.preventDefault()
    setDragOverMode(null)
    if (isGenerating || isIngesting) return
    const picked = Array.from(e.dataTransfer.files).filter(isReceiptFile)
    if (picked.length === 0) return
    return scanReceipts(picked, lineItemsField, mode)
  }

  function dropZoneProps(lineItemsField: LineItemsArrayFieldT, mode: ScanModeT) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        setDragOverMode(mode)
      },
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault()
        // The icon and the label are inside the button, so crossing them fires a leave that is not
        // a leave — without this the strong state drops out and returns on the next dragover.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDragOverMode(null)
      },
      onDrop: (e: React.DragEvent) => handleDropReceipts(e, lineItemsField, mode),
      className: cn(
        isFileDragActive &&
          dragOverMode !== mode &&
          !(isGenerating || isIngesting) &&
          FILE_DRAG_ARMED_CLASS,
        dragOverMode === mode && FILE_DRAG_OVER_CLASS,
      ),
    }
  }

  return (
    <form.Field name="lineItems" mode="array">
      {(lineItemsField: LineItemsArrayFieldT) => (
        <div className="space-y-4">
          <div className="space-y-6">
            {lineItemsField.state.value.map((item, index: number) => (
              <Fragment key={item.id}>
                <div className="space-y-2">
                  {/* Top-aligned, not bottom: every field here carries a label, so their inputs
                    line up on their own — and a validation error growing under one field can no
                    longer drag its neighbours (and the delete button) down a line. The label-less
                    slots below pay for it with an mt-6 that clears a label + its gap. */}
                  <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                    <form.AppField name={`lineItems[${index}].amount`}>
                      {(field) => (
                        <field.Input
                          // Named outright once a Netto column sits next to it — an unqualified
                          // „Kwota" beside „Netto" reads as the amount that bills the client,
                          // which is exactly backwards on this type.
                          label={showsNetAmount ? 'Brutto' : 'Kwota'}
                          placeholder="0.00 PLN"
                          type="number"
                          showError
                          fieldClassName="w-28"
                        />
                      )}
                    </form.AppField>
                    {showsNetAmount && (
                      <form.AppField name={`lineItems[${index}].netAmount`}>
                        {(field) => (
                          <field.Input
                            label="Netto"
                            placeholder="0.00 PLN"
                            type="number"
                            showError
                            fieldClassName="w-28"
                          />
                        )}
                      </form.AppField>
                    )}
                    <form.AppField name={`lineItems[${index}].description`}>
                      {(field) => (
                        <field.Input
                          label="Opis"
                          placeholder="Opcjonalnie"
                          showError
                          fieldClassName="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1"
                        />
                      )}
                    </form.AppField>
                    {inlineCategory && (
                      <CategorySelect
                        form={form}
                        index={index}
                        config={inlineCategory}
                        fieldClassName="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1"
                      />
                    )}
                    {/* No icon: this row is already Kwota + Netto + Opis + kategoria + the delete
                      slot, and a `shrink-0` glyph would take its ~1rem straight off the flex-1
                      inputs. `tone="error"` alone carries the alarm here. */}
                    {failedIds?.has(item.id) && (
                      <Description
                        tone="error"
                        size="xs"
                        withIcon={false}
                        className="mt-8 shrink-0 whitespace-nowrap"
                      >
                        nie odczytano
                      </Description>
                    )}
                    {/* Delete lives in row 1, its height matching the inputs; the row being read
                      shows the loader in its slot and queued rows keep it disabled — removing a
                      row mid-generation shifts the array under in-flight extraction tasks (captured
                      index), landing a result on the wrong row. */}
                    <div className="mt-6 flex size-9 shrink-0 items-center justify-center">
                      {generatingIds?.has(item.id) || ingestingIds?.has(item.id) ? (
                        <GradientSpinner />
                      ) : (
                        <RemoveButton
                          icon={Trash2}
                          onClick={() => onRemoveItem(item.id, index, lineItemsField.removeValue)}
                          disabled={
                            isGenerating || isIngesting || lineItemsField.state.value.length === 1
                          }
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    {secondRowCategory && (
                      <CategorySelect
                        form={form}
                        index={index}
                        config={secondRowCategory}
                        fieldClassName="min-w-0 flex-1"
                      />
                    )}
                    <LineItemInvoiceField
                      id={item.id}
                      files={getRowFiles(item.id)}
                      fieldClassName="min-w-0 flex-1"
                      onFileChange={onFileChange}
                      onRemoveFile={onRemoveFile}
                    />
                  </div>
                  <form.AppField name={`lineItems[${index}].invoiceNote`}>
                    {(field) => (
                      <field.Textarea
                        label="Notatka"
                        placeholder="Opcjonalnie"
                        rows={2}
                        showError
                        fieldClassName="w-full"
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => lineItemsField.pushValue(newItem())}
            >
              Dodaj pozycję
            </Button>
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="sr-only"
              onChange={(e) => handleScanReceipts(e, lineItemsField, scanMode)}
            />
            {onGenerate && (
              <>
                <ToggleGroup
                  options={SCAN_MODE_OPTIONS}
                  value={scanMode}
                  onChange={setScanMode}
                  aria-label="Co oznaczają wybrane zdjęcia"
                />
                <Button
                  type="button"
                  variant="ai"
                  size="sm"
                  onClick={() => scanInputRef.current?.click()}
                  disabled={isGenerating || isIngesting}
                  {...dropZoneProps(lineItemsField, scanMode)}
                >
                  {isGenerating || isIngesting ? (
                    <GradientSpinner />
                  ) : (
                    <WandSparkles className="text-neon-cyan" />
                  )}
                  <span className="text-neon-cyan font-semibold">Wygeneruj z paragonów</span>
                </Button>
              </>
            )}
            {generationProgress && (
              <span className="text-muted-foreground self-center text-sm">
                Odczytano {generationProgress.done}/{generationProgress.total}
              </span>
            )}
          </div>
          {onGenerate && <Description size="xs">{SCAN_MODE_HINT[scanMode]}</Description>}
          <Label>Suma: {formatPLN(total)}</Label>
        </div>
      )}
    </form.Field>
  )
}
