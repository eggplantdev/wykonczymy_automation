'use client'

import { SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { RemoveButton } from '@/components/ui/remove-button'
import { FileInput } from '@/components/ui/file-input'
import { Label } from '@/components/ui/label'
import { formatPLN } from '@/lib/format-currency'
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
  readonly fieldName: string
  readonly label: string
  readonly placeholder: string
  readonly options: ReadonlyArray<{ readonly id: number; readonly name: string }>
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
  onRemoveItem: (index: number, removeValue: (index: number) => void) => void
  onFileChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void
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
): CategoryFieldConfigT | undefined {
  if (needsExpenseCategory(type)) {
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
        <field.Select
          label={config.label}
          placeholder={config.placeholder}
          showError
          fieldClassName={fieldClassName}
        >
          {config.options.map((opt) => (
            <SelectItem key={opt.id} value={String(opt.id)}>
              {opt.name}
            </SelectItem>
          ))}
        </field.Select>
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
  onRemoveItem,
  onFileChange,
}: LineItemsFieldPropsT) {
  const inlineCategory = getInlineCategory(transferType, referenceData)
  const secondRowCategory = getSecondRowCategory(transferType, referenceData)
  const emptyItem = defaultExpenseCategory
    ? { ...EMPTY_LINE_ITEM, expenseCategory: defaultExpenseCategory }
    : EMPTY_LINE_ITEM

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
                  <div className="min-w-0 flex-1">
                    {/* <Label className="mb-2 block">FV</Label> */}
                    <FileInput
                      label="Przeciągnij lub kliknij"
                      accept="image/*,application/pdf"
                      onChange={(e) => onFileChange(index, e)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => lineItemsField.pushValue(emptyItem)}
          >
            Dodaj pozycję
          </Button>
          <Label>Suma: {formatPLN(total)}</Label>
        </div>
      )}
    </form.Field>
  )
}
