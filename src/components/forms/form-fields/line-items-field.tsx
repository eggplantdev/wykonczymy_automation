'use client'

import { SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { RemoveButton } from '@/components/ui/remove-button'
import { FileInput } from '@/components/ui/file-input'
import { Label } from '@/components/ui/label'
import { formatPLN } from '@/lib/format-currency'
import { EXPENSE_CATEGORY_LABEL } from '@/lib/constants/transfers'
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

type LineItemsFieldPropsT = {
  form: FormT
  transferType: string
  referenceData: ReferenceDataBaseT
  label?: string
  emptyItem: Record<string, string>
  total: number
  onRemoveItem: (index: number, removeValue: (index: number) => void) => void
  onFileChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void
}

function getInlineCategory(
  type: string,
  refData: ReferenceDataBaseT,
): CategoryFieldConfigT | undefined {
  if (type === 'INVESTMENT_EXPENSE') {
    return {
      fieldName: 'expenseCategory',
      label: EXPENSE_CATEGORY_LABEL,
      placeholder: `${EXPENSE_CATEGORY_LABEL} *`,
      options: refData.expenseCategories,
    }
  }
  if (type === 'OTHER') {
    return {
      fieldName: 'category',
      label: 'Kategoria',
      placeholder: 'Opcjonalnie',
      options: refData.otherCategories,
    }
  }
  return undefined
}

function getSecondRowCategory(
  type: string,
  refData: ReferenceDataBaseT,
): CategoryFieldConfigT | undefined {
  if (type === 'INVESTMENT_EXPENSE') {
    return {
      fieldName: 'category',
      label: 'Kategoria',
      placeholder: 'Opcjonalnie',
      options: refData.otherCategories,
    }
  }
  return undefined
}

export function LineItemsField({
  form,
  transferType,
  referenceData,
  label = 'Pozycje',
  emptyItem,
  total,
  onRemoveItem,
  onFileChange,
}: LineItemsFieldPropsT) {
  const inlineCategory = getInlineCategory(transferType, referenceData)
  const secondRowCategory = getSecondRowCategory(transferType, referenceData)

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
                  <div className="w-28">
                    <form.AppField name={`lineItems[${index}].amount`}>
                      {(field: AppFieldComponentsT) => (
                        <field.Input label="Kwota" placeholder="0.00 PLN" type="number" showError />
                      )}
                    </form.AppField>
                  </div>
                  <div className="min-w-0 flex-1">
                    <form.AppField name={`lineItems[${index}].description`}>
                      {(field: AppFieldComponentsT) => (
                        <field.Input label="Opis" placeholder="Opcjonalnie" showError />
                      )}
                    </form.AppField>
                  </div>
                  {inlineCategory && (
                    <div className="min-w-0 flex-1">
                      <form.AppField name={`lineItems[${index}].${inlineCategory.fieldName}`}>
                        {(field: AppFieldComponentsT) => (
                          <field.Select
                            label={inlineCategory.label}
                            placeholder={inlineCategory.placeholder}
                            showError
                          >
                            {inlineCategory.options.map((opt) => (
                              <SelectItem key={opt.id} value={String(opt.id)}>
                                {opt.name}
                              </SelectItem>
                            ))}
                          </field.Select>
                        )}
                      </form.AppField>
                    </div>
                  )}
                  <RemoveButton
                    className="mb-0.5"
                    onClick={() => onRemoveItem(index, lineItemsField.removeValue)}
                    disabled={lineItemsField.state.value.length === 1}
                  />
                </div>
                <div className="flex items-start gap-2 pr-10 pl-8">
                  {secondRowCategory && (
                    <div className="min-w-0 flex-1">
                      <form.AppField name={`lineItems[${index}].${secondRowCategory.fieldName}`}>
                        {(field: AppFieldComponentsT) => (
                          <field.Select
                            label={secondRowCategory.label}
                            placeholder={secondRowCategory.placeholder}
                            showError
                          >
                            {secondRowCategory.options.map((opt) => (
                              <SelectItem key={opt.id} value={String(opt.id)}>
                                {opt.name}
                              </SelectItem>
                            ))}
                          </field.Select>
                        )}
                      </form.AppField>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <form.AppField name={`lineItems[${index}].invoiceNote`}>
                      {(field: AppFieldComponentsT) => (
                        <field.Input label="Notatka" placeholder="Opcjonalnie" showError />
                      )}
                    </form.AppField>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Label className="mb-2 block">FV</Label>
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
