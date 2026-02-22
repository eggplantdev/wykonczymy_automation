'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FileInput } from '@/components/ui/file-input'
import { formatPLN } from '@/lib/format-currency'

type LineItemsFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  label?: string
  emptyItem: Record<string, string>
  total: number
  onRemoveItem: (index: number, removeValue: (index: number) => void) => void
  onFileChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void
  renderItemExtras?: (index: number) => React.ReactNode
}

export function LineItemsField({
  form,
  label = 'Pozycje',
  emptyItem,
  total,
  onRemoveItem,
  onFileChange,
  renderItemExtras,
}: LineItemsFieldPropsT) {
  return (
    <form.Field name="lineItems" mode="array">
      {(lineItemsField: {
        state: { value: unknown[] }
        removeValue: (index: number) => void
        pushValue: (value: Record<string, string>) => void
      }) => (
        <div className="space-y-4">
          <p className="text-foreground text-sm font-medium">{label}</p>
          {lineItemsField.state.value.map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <form.AppField name={`lineItems[${index}].description`}>
                    {(field: { Input: React.FC<{ placeholder: string; showError: boolean }> }) => (
                      <field.Input placeholder="Opis pozycji" showError />
                    )}
                  </form.AppField>
                </div>
                <div className="w-36">
                  <form.AppField name={`lineItems[${index}].amount`}>
                    {(field: {
                      Input: React.FC<{ placeholder: string; type: string; showError: boolean }>
                    }) => <field.Input placeholder="Kwota" type="number" showError />}
                  </form.AppField>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveItem(index, lineItemsField.removeValue)}
                  disabled={lineItemsField.state.value.length === 1}
                  aria-label="Usuń pozycję"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <FileInput
                accept="image/*,application/pdf"
                onChange={(e) => onFileChange(index, e)}
              />
              {renderItemExtras?.(index)}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => lineItemsField.pushValue(emptyItem)}
          >
            Dodaj pozycję
          </Button>
          <p className="text-foreground text-sm font-medium">Suma: {formatPLN(total)}</p>
        </div>
      )}
    </form.Field>
  )
}
