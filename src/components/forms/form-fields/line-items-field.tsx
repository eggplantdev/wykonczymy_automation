'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { RemoveButton } from '@/components/ui/remove-button'
import { FileInput } from '@/components/ui/file-input'
import { Label } from '@/components/ui/label'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  EXPENSE_CATEGORY_LABEL,
  needsExpenseCategory,
  showsOtherCategory,
} from '@/lib/constants/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { AppFieldComponentsT } from '@/components/forms/types/form-types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormT = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ArrayFieldT = any

type CategoryFieldConfigT = {
  fieldName: string
  label: string
  placeholder: string
  options: { id: number; name: string }[]
}

const EMPTY_LINE_ITEM: Record<string, string> = {
  description: '',
  amount: '',
  invoiceNote: '',
  category: '',
  expenseCategory: '',
}

type LineItemsFieldPropsT = {
  form: FormT
  transferType: string
  referenceData: ReferenceDataBaseT
  label?: string
  defaultExpenseCategory?: string
  total: number
  hasInvestment?: boolean
  onRemoveItem: (index: number, removeValue: (index: number) => void) => void
  onFileChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void
  // Batch-attach N receipt images: register each file at its row index (see use-invoice-files).
  onRegisterFiles: (startIndex: number, files: File[]) => void
  // Read a row's attached filename so its file input can display it after a batch add.
  getFileName: (index: number) => string | undefined
  // Bump to force-remount the uncontrolled file inputs (clears their selection).
  fileInputKey?: number
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
  form: FormT
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
          showError
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
  label = 'Pozycje',
  defaultExpenseCategory = '',
  total,
  hasInvestment,
  onRemoveItem,
  onFileChange,
  onRegisterFiles,
  getFileName,
  fileInputKey = 0,
}: LineItemsFieldPropsT) {
  const inlineCategory = getInlineCategory(transferType, referenceData, hasInvestment)
  const secondRowCategory = getSecondRowCategory(transferType, referenceData)
  const emptyItem = defaultExpenseCategory
    ? { ...EMPTY_LINE_ITEM, expenseCategory: defaultExpenseCategory }
    : EMPTY_LINE_ITEM
  const receiptInputRef = useRef<HTMLInputElement>(null)

  function handleAddReceipts(e: React.ChangeEvent<HTMLInputElement>, lineItemsField: ArrayFieldT) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-picking the same files after a reset
    if (picked.length === 0) return

    // Reuse the lone initial blank row for the first image so the first receipt lands on
    // row 0 rather than after an empty row; otherwise append after the existing rows.
    const rows = lineItemsField.state.value as { description: string; amount: string }[]
    const reuseFirstRow = rows.length === 1 && !rows[0].description && !rows[0].amount
    const startIndex = reuseFirstRow ? 0 : rows.length
    const rowsToPush = reuseFirstRow ? picked.length - 1 : picked.length

    for (let i = 0; i < rowsToPush; i++) lineItemsField.pushValue(emptyItem)
    onRegisterFiles(startIndex, picked)
  }

  return (
    <form.Field name="lineItems" mode="array">
      {(lineItemsField: ArrayFieldT) => (
        <div className="space-y-4">
          <Label>{label}</Label>
          <div className="space-y-4">
            {lineItemsField.state.value.map((_: unknown, index: number) => (
              <div key={index} className="space-y-2">
                <div className="flex items-end gap-2">
                  <span className="text-muted-foreground mb-2 w-6 shrink-0 text-center text-sm font-medium">
                    {index + 1}.
                  </span>
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
                  <RemoveButton
                    className="mb-0.5"
                    onClick={() => onRemoveItem(index, lineItemsField.removeValue)}
                    disabled={lineItemsField.state.value.length === 1}
                  />
                </div>
                <div className="flex items-start gap-2 pr-10 pl-8">
                  {secondRowCategory && (
                    <CategorySelect
                      form={form}
                      index={index}
                      config={secondRowCategory}
                      fieldClassName="min-w-0 flex-1"
                    />
                  )}
                  <form.AppField name={`lineItems[${index}].invoiceNote`}>
                    {(field: AppFieldComponentsT) => (
                      <field.Input
                        label="Notatka"
                        placeholder="Opcjonalnie"
                        showError
                        fieldClassName="min-w-0 flex-1"
                      />
                    )}
                  </form.AppField>
                  <FileInput
                    key={`file-${fileInputKey}-${index}`}
                    label="FV"
                    fieldClassName="min-w-0 flex-1"
                    accept="image/*,application/pdf"
                    initialFileName={getFileName(index)}
                    onChange={(e) => onFileChange(index, e)}
                  />
                </div>
              </div>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => receiptInputRef.current?.click()}
            >
              Dodaj paragony
            </Button>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => handleAddReceipts(e, lineItemsField)}
            />
          </div>
          <Label>Suma: {formatPLN(total)}</Label>
        </div>
      )}
    </form.Field>
  )
}
