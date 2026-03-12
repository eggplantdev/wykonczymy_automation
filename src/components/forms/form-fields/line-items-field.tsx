'use client'

import { Button } from '@/components/ui/button'
import { RemoveButton } from '@/components/ui/remove-button'
import { FileInput } from '@/components/ui/file-input'
import { Label } from '@/components/ui/label'
import { formatPLN } from '@/lib/format-currency'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormT = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FieldT = any

type LineItemsFieldPropsT = {
  form: FormT
  label?: string
  emptyItem: Record<string, string>
  total: number
  onRemoveItem: (index: number, removeValue: (index: number) => void) => void
  onFileChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void
  renderItemInline?: (index: number) => React.ReactNode
  renderItemSecondRow?: (index: number) => React.ReactNode
}

export function LineItemsField({
  form,
  label = 'Pozycje',
  emptyItem,
  total,
  onRemoveItem,
  onFileChange,
  renderItemInline,
  renderItemSecondRow,
}: LineItemsFieldPropsT) {
  return (
    <form.Field name="lineItems" mode="array">
      {(lineItemsField: FieldT) => (
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
                      {(field: FieldT) => (
                        <field.Input label="Kwota" placeholder="0.00 PLN" type="number" showError />
                      )}
                    </form.AppField>
                  </div>
                  <div className="min-w-0 flex-1">
                    <form.AppField name={`lineItems[${index}].description`}>
                      {(field: FieldT) => (
                        <field.Input label="Opis" placeholder="Opcjonalnie" showError />
                      )}
                    </form.AppField>
                  </div>
                  {renderItemInline?.(index)}
                  <RemoveButton
                    className="mb-0.5"
                    onClick={() => onRemoveItem(index, lineItemsField.removeValue)}
                    disabled={lineItemsField.state.value.length === 1}
                  />
                </div>
                <div className="flex items-start gap-2 pr-10 pl-8">
                  {renderItemSecondRow?.(index)}
                  <div className="min-w-0 flex-1">
                    <form.AppField name={`lineItems[${index}].invoiceNote`}>
                      {(field: FieldT) => (
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
