'use client'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { RemoveButton } from '@/components/ui/remove-button'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import type { ArrayFieldT } from '@/components/forms/hooks/form-api-of'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { useOrderSettingsFormStore } from '@/stores/form-stores'
import { saveOrderSettingsAction } from '@/lib/actions/order-settings'
import type { OrderSettingsT } from '@/types/order-settings'
import {
  makeSupplierRow,
  orderSettingsFormSchema,
  type OrderSettingsDataT,
  type OrderSettingsFormValuesT,
} from './order-settings-schema'

type PropsT = {
  formId: string
  settings: OrderSettingsT
  onSubmitSuccess: () => void
}

export function OrderSettingsForm({ formId, settings, onSubmitSuccess }: PropsT) {
  const { form, reset } = useManagedForm<OrderSettingsFormValuesT, OrderSettingsDataT>({
    formId,
    useFormStore: useOrderSettingsFormStore,
    schema: orderSettingsFormSchema,
    defaultValues: {
      suppliers: settings.suppliers,
      bigBagPrice: String(settings.bigBagPrice),
      containerPrice: String(settings.containerPrice),
    },
    successMessage: 'Zapisano ustawienia zamówień',
    onSubmitSuccess,
    action: saveOrderSettingsAction,
    // An edit form over a live global: a restored draft would revert a change somebody else made.
    persistDraft: false,
    toData: (value) => ({
      suppliers: value.suppliers.map((row) => ({
        id: row.id,
        name: row.name.trim(),
        phone: row.phone.trim(),
      })),
      bigBagPrice: Number(value.bigBagPrice),
      containerPrice: Number(value.containerPrice),
    }),
  })

  return (
    <FormShell form={form} onReset={reset}>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <form.AppField name="bigBagPrice">
            {(field) => <field.Input label="Cena big bag (zł)" type="number" showError />}
          </form.AppField>
          <form.AppField name="containerPrice">
            {(field) => <field.Input label="Cena kontenera (zł)" type="number" showError />}
          </form.AppField>
        </div>
        <form.Field name="suppliers" mode="array">
          {(suppliersField: ArrayFieldT<OrderSettingsFormValuesT['suppliers'][number]>) => (
            <div className="space-y-3">
              {suppliersField.state.value.map((row, index) => (
                <div key={row.id} className="flex items-end gap-2">
                  <form.AppField name={`suppliers[${index}].name`}>
                    {(field) => (
                      <field.Input
                        label={index === 0 ? 'Dostawca' : undefined}
                        placeholder="Nazwa"
                        showError
                        fieldClassName="min-w-0 flex-1"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name={`suppliers[${index}].phone`}>
                    {(field) => (
                      <field.Input
                        label={index === 0 ? 'Telefon' : undefined}
                        type="tel"
                        placeholder="601 234 567"
                        showError
                        fieldClassName="min-w-0 flex-1"
                      />
                    )}
                  </form.AppField>
                  <RemoveButton
                    onClick={() => suppliersField.removeValue(index)}
                    aria-label="Usuń dostawcę"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => suppliersField.pushValue(makeSupplierRow())}
              >
                Dodaj dostawcę
              </Button>
            </div>
          )}
        </form.Field>
      </FieldGroup>
      <FormFooter label="Zapisz" submittingLabel="Zapisywanie..." className="mt-6" />
    </FormShell>
  )
}
