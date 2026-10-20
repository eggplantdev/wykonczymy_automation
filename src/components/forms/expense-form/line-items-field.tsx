'use client'

import { Fragment } from 'react'
import { Trash2, Unlink, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Description } from '@/components/ui/description'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { RemoveButton } from '@/components/ui/remove-button'
import { LineItemInvoiceField } from '@/components/forms/expense-form/line-item-invoice-field'
import { formatPLN } from '@/lib/utils/format-currency'
import { billsNetAmount } from '@/lib/constants/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { ScanModeT } from '@/lib/constants/receipt-scan'
import {
  isBlankRow,
  makeLineItem,
  type BulkExpenseFormApiT,
  type BulkLineItemT,
  type ReceiptGroupingT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { CollapsibleLineItem } from '@/components/forms/expense-form/collapsible-line-item'
import type { DecisionStatusT } from '@/components/ui/decision-progress-badge'
import { ReceiptSelectionActions } from '@/components/forms/expense-form/receipt-selection-actions'
import { orderedEntries } from '@/lib/worker-expenses/ordered-entries'
import { RowSelect } from '@/components/forms/expense-form/row-select'
import {
  getInlineCategory,
  getSecondRowSelects,
} from '@/components/forms/expense-form/row-select-config'
import {
  useReceiptScan,
  type LineItemsArrayFieldT,
} from '@/components/forms/expense-form/use-receipt-scan'

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
  total?: number
  hasInvestment?: boolean
  onRemoveItem: (id: string, index: number, removeValue: (index: number) => void) => void
  onRemoveLastItem?: () => void
  onFileChange: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (id: string, index: number) => void
  onRegisterFiles: (ids: string[], files: File[], mode?: 'per-row' | 'single-row') => Promise<void>
  getRowFiles: (id: string) => File[] | undefined
  onGenerate?: () => void
  onGenerateRow?: (id: string) => void
  isGenerating?: boolean
  generatingIds?: Set<string>
  ingestingIds?: Set<string>
  failedIds?: Set<string>
  generationProgress?: { done: number; total: number } | null
  receiptGrouping?: ReceiptGroupingT
  hiddenStatuses?: ReadonlySet<DecisionStatusT>
  wrapRow?: (
    itemId: string,
    renderRow: (hint: React.ReactNode) => React.ReactNode,
    positionOf: (itemId: string) => number | undefined,
  ) => React.ReactNode
}

const rowTitle = (item: BulkLineItemT) =>
  [item.description || 'Bez opisu', item.amount && formatPLN(Number(item.amount))]
    .filter(Boolean)
    .join(' · ')

export function LineItemsField({
  form,
  transferType,
  referenceData,
  defaultExpenseCategory = '',
  total,
  hasInvestment,
  onRemoveItem,
  onRemoveLastItem,
  onFileChange,
  onRemoveFile,
  onRegisterFiles,
  getRowFiles,
  onGenerate,
  onGenerateRow,
  isGenerating = false,
  generatingIds,
  ingestingIds,
  failedIds,
  generationProgress,
  receiptGrouping,
  hiddenStatuses,
  wrapRow,
}: LineItemsFieldPropsT) {
  const inlineCategory = getInlineCategory(transferType, referenceData, hasInvestment)
  const showsNetAmount = billsNetAmount(transferType)
  const secondRowSelects = getSecondRowSelects(transferType, referenceData)
  const newItem = () =>
    makeLineItem(defaultExpenseCategory ? { expenseCategory: defaultExpenseCategory } : undefined)
  const isDecideMode = !!receiptGrouping?.onDecide
  const isIngesting = (ingestingIds?.size ?? 0) > 0
  const { scanInputRef, scanMode, setScanMode, handleScanReceipts, dropZoneProps } = useReceiptScan(
    {
      newItem,
      getRowFiles,
      onRegisterFiles,
      onGenerate,
      isBusy: isGenerating || isIngesting,
    },
  )

  return (
    <form.Field name="lineItems" mode="array">
      {(lineItemsField: LineItemsArrayFieldT) => {
        const numbered = orderedEntries(
          lineItemsField.state.value,
          receiptGrouping?.onDecide && receiptGrouping.readRowOf,
        ).map((entry, position) => ({ ...entry, position }))
        const positionOf = (itemId: string) =>
          numbered.find((entry) => entry.item.id === itemId)?.position
        const entries = numbered.filter(
          (entry) => !hiddenStatuses?.has(receiptGrouping?.statusOf(entry.item.id) ?? 'pending'),
        )

        const selectCheckbox = (id: string, position: number, className?: string) =>
          receiptGrouping?.selectableIds.has(id) && (
            <Checkbox
              className={className}
              aria-label={`Zaznacz pozycję ${position + 1}`}
              checked={receiptGrouping.selectedIds.has(id)}
              onCheckedChange={() => receiptGrouping.onToggle(id)}
              disabled={receiptGrouping.disabled}
            />
          )

        const renderFields = (item: BulkLineItemT, index: number, hint: React.ReactNode) => (
          <div className="min-w-0 flex-1 space-y-2">
            {hint}
            <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
              <form.AppField name={`lineItems[${index}].amount`}>
                {(field) => (
                  <field.Input
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
                <RowSelect
                  form={form}
                  index={index}
                  config={inlineCategory}
                  fieldClassName="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1"
                />
              )}
              {(failedIds?.has(item.id) || receiptGrouping?.incompleteIds.has(item.id)) && (
                <Description tone="error" size="xs" className="mt-8 shrink-0 whitespace-nowrap">
                  nie odczytano
                </Description>
              )}
              {(generatingIds?.has(item.id) || ingestingIds?.has(item.id) || !isDecideMode) && (
                <div className="mt-6 flex size-9 shrink-0 items-center justify-center">
                  {generatingIds?.has(item.id) || ingestingIds?.has(item.id) ? (
                    <GradientSpinner />
                  ) : (
                    <RemoveButton
                      icon={Trash2}
                      onClick={() =>
                        lineItemsField.state.value.length === 1
                          ? onRemoveLastItem?.()
                          : onRemoveItem(item.id, index, lineItemsField.removeValue)
                      }
                      disabled={
                        isGenerating ||
                        isIngesting ||
                        (lineItemsField.state.value.length === 1 && !onRemoveLastItem)
                      }
                    />
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              {secondRowSelects.map((config) => (
                <RowSelect
                  key={config.fieldName}
                  form={form}
                  index={index}
                  config={config}
                  fieldClassName="min-w-0 flex-1"
                />
              ))}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <LineItemInvoiceField
                  id={item.id}
                  files={getRowFiles(item.id)}
                  onFileChange={onFileChange}
                  onRemoveFile={onRemoveFile}
                />
                {receiptGrouping?.statusOf(item.id) === 'pending' &&
                  receiptGrouping.isAcceptBlocked?.(item.id) && (
                    <Description tone="error" withIcon size="xs">
                      Nie udało się pobrać zdjęcia paragonu — dodaj je w polu „FV”, żeby go przyjąć.
                    </Description>
                  )}
              </div>
              {/* A re-read would put one paragon's values over the whole merged row. */}
              {receiptGrouping?.mergedIds.has(item.id) ? (
                <Button
                  type="button"
                  variant="outline"
                  className="sm:mt-6"
                  onClick={() => receiptGrouping.onSplit(item.id)}
                  disabled={receiptGrouping.disabled || receiptGrouping.isRegroupBlocked}
                >
                  <Unlink />
                  Rozłącz
                </Button>
              ) : (
                onGenerateRow &&
                getRowFiles(item.id) && (
                  <Button
                    type="button"
                    variant="ai"
                    className="sm:mt-6"
                    onClick={() => onGenerateRow(item.id)}
                    disabled={isGenerating || isIngesting}
                  >
                    <WandSparkles className="text-neon-cyan" />
                    <span className="text-neon-cyan font-semibold">Odczytaj ponownie</span>
                  </Button>
                )
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <form.AppField name={`lineItems[${index}].documentNumber`}>
                {(field) => (
                  <field.Input label="Nr dokumentu" placeholder="Opcjonalnie" showError />
                )}
              </form.AppField>
              <form.AppField name={`lineItems[${index}].sellerNip`}>
                {(field) => (
                  <field.Input label="NIP sprzedawcy" placeholder="Opcjonalnie" showError />
                )}
              </form.AppField>
              <form.AppField name={`lineItems[${index}].documentDate`}>
                {(field) => <field.DatePicker label="Data na paragonie" showError />}
              </form.AppField>
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
        )

        const decideActions = (itemId: string) =>
          receiptGrouping?.onDecide &&
          receiptGrouping.selectableIds.has(itemId) && (
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                disabled={receiptGrouping.disabled || receiptGrouping.isAcceptBlocked?.(itemId)}
                onClick={() => receiptGrouping.onDecide?.([itemId], 'accept')}
              >
                Przyjmij
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={receiptGrouping.disabled}
                onClick={() => receiptGrouping.onDecide?.([itemId], 'reject')}
              >
                Odrzuć
              </Button>
            </div>
          )

        return (
          <div className="space-y-4">
            {receiptGrouping && !isDecideMode && receiptGrouping.selectableIds.size > 1 && (
              <ReceiptSelectionActions grouping={receiptGrouping} />
            )}
            <div className="space-y-6">
              {entries.map((entry, visibleIndex) => {
                const { position } = entry
                const status = receiptGrouping?.statusOf(entry.item.id) ?? 'pending'
                const undo = status === 'rejected' && receiptGrouping?.undoFor?.(entry.item.id)
                const renderRow = (hint: React.ReactNode) =>
                  isDecideMode ? (
                    // Remounts on a decision, so the row folds as it is decided.
                    <CollapsibleLineItem
                      key={status}
                      title={`${position + 1}. ${rowTitle(entry.item)}`}
                      status={status}
                      defaultOpen={status === 'pending'}
                      leading={status === 'pending' && selectCheckbox(entry.item.id, position)}
                      action={
                        undo ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={receiptGrouping?.disabled}
                            onClick={undo}
                          >
                            Cofnij
                          </Button>
                        ) : (
                          status === 'pending' && decideActions(entry.item.id)
                        )
                      }
                    >
                      {renderFields(entry.item, entry.index, hint)}
                    </CollapsibleLineItem>
                  ) : (
                    <div className="flex gap-2">
                      {selectCheckbox(entry.item.id, position, 'mt-8.5')}
                      {lineItemsField.state.value.length > 1 && (
                        <span className="text-muted-foreground mt-6 flex h-9 shrink-0 items-center text-xs tabular-nums">
                          {position + 1}.
                        </span>
                      )}
                      {renderFields(entry.item, entry.index, hint)}
                    </div>
                  )
                return (
                  <Fragment key={entry.item.id}>
                    {wrapRow ? wrapRow(entry.item.id, renderRow, positionOf) : renderRow(null)}
                    {visibleIndex < entries.length - 1 && (
                      <Separator orientation="horizontal" className="bg-foreground" />
                    )}
                  </Fragment>
                )
              })}
            </div>
            {!isDecideMode && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={scanInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="sr-only"
                    onChange={(e) => handleScanReceipts(e, lineItemsField)}
                  />
                  {onGenerate && (
                    <ToggleGroup
                      options={SCAN_MODE_OPTIONS}
                      value={scanMode}
                      onChange={setScanMode}
                      aria-label="Co oznaczają wybrane zdjęcia"
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => lineItemsField.pushValue(newItem())}
                  >
                    Dodaj pozycję
                  </Button>
                </div>
                {onGenerate && <Description size="xs">{SCAN_MODE_HINT[scanMode]}</Description>}
                {onGenerate && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ai"
                      size="sm"
                      onClick={() => scanInputRef.current?.click()}
                      pending={isGenerating || isIngesting}
                      {...dropZoneProps(lineItemsField)}
                    >
                      <WandSparkles className="text-neon-cyan" />
                      <span className="text-neon-cyan font-semibold">Wygeneruj z paragonów</span>
                    </Button>
                    {lineItemsField.state.value.some(
                      (row) => getRowFiles(row.id) && isBlankRow(row),
                    ) && (
                      <Button
                        type="button"
                        variant="ai"
                        size="sm"
                        onClick={() => onGenerate()}
                        disabled={isGenerating || isIngesting}
                      >
                        <WandSparkles className="text-neon-cyan" />
                        <span className="text-neon-cyan font-semibold">
                          Odczytaj dodane zdjęcia
                        </span>
                      </Button>
                    )}
                    {generationProgress && (
                      <span className="text-muted-foreground self-center text-sm">
                        Odczytano {generationProgress.done}/{generationProgress.total}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
            {total !== undefined && (
              <p className="text-sm leading-none font-medium">Suma: {formatPLN(total)}</p>
            )}
          </div>
        )
      }}
    </form.Field>
  )
}
