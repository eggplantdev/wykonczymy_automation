'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
}

export function LineItemsField({
  form,
  label = 'Pozycje',
  emptyItem,
  total,
  onRemoveItem,
  onFileChange,
  renderItemInline,
}: LineItemsFieldPropsT) {
  return (
    <form.Field name="lineItems" mode="array">
      {(lineItemsField: FieldT) => (
        <div className="space-y-4">
          <Label>{label}</Label>
          <ol className="list-decimal space-y-4 pl-4">
            {lineItemsField.state.value.map((_: unknown, index: number) => (
              <li key={index}>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-28">
                        <form.AppField name={`lineItems[${index}].amount`}>
                          {(field: FieldT) => (
                            <field.Input placeholder="Kwota" type="number" showError />
                          )}
                        </form.AppField>
                      </div>
                      <div className="min-w-0 flex-1">
                        <form.AppField name={`lineItems[${index}].description`}>
                          {(field: FieldT) => <field.Input placeholder="Opis" showError />}
                        </form.AppField>
                      </div>
                      {renderItemInline?.(index)}
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <form.AppField name={`lineItems[${index}].invoiceNote`}>
                          {(field: FieldT) => <field.Input placeholder="Notatka" showError />}
                        </form.AppField>
                      </div>
                      <FileInput
                        className="min-w-0 flex-1"
                        accept="image/*,application/pdf"
                        onChange={(e) => onFileChange(index, e)}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveItem(index, lineItemsField.removeValue)}
                    disabled={lineItemsField.state.value.length === 1}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
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
