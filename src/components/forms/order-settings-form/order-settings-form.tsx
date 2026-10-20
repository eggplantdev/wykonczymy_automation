'use client'

import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { RemoveButton } from '@/components/ui/remove-button'
import { SELECT_NONE, SimpleSelect } from '@/components/ui/simple-select'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { useStore } from '@/components/forms/hooks/form-hooks'
import FormBase from '@/components/forms/form-components/form-base'
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

const chosenSupplier = (supplierId: string) => (supplierId === SELECT_NONE ? undefined : supplierId)

export function OrderSettingsForm({ formId, settings, onSubmitSuccess }: PropsT) {
  const { form } = useManagedForm<OrderSettingsFormValuesT, OrderSettingsDataT>({
    formId,
    useFormStore: useOrderSettingsFormStore,
    schema: orderSettingsFormSchema,
    defaultValues: {
      suppliers: settings.suppliers,
      bigBagPrice: String(settings.bigBagPrice),
      containerPrice: String(settings.containerPrice),
      defaultBigBagSupplierId: settings.defaultBigBagSupplierId ?? SELECT_NONE,
      defaultContainerSupplierId: settings.defaultContainerSupplierId ?? SELECT_NONE,
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
      defaultBigBagSupplierId: chosenSupplier(value.defaultBigBagSupplierId),
      defaultContainerSupplierId: chosenSupplier(value.defaultContainerSupplierId),
    }),
  })

  const suppliers = useStore(form.store, (state) => state.values.suppliers)
  const supplierOptions = [
    { value: SELECT_NONE, label: '— brak —' },
    ...suppliers.map((row) => ({ value: row.id, label: row.name.trim() || 'Bez nazwy' })),
  ]
  const shownSupplier = (supplierId: string) =>
    suppliers.some((row) => row.id === supplierId) ? supplierId : SELECT_NONE

  return (
    <FormShell form={form}>
      <FieldGroup>
        <div className="flex items-end gap-2">
          <form.AppField name="bigBagPrice">
            {(field) => (
              <field.Input
                label="Cena big bag (zł)"
                type="number"
                showError
                fieldClassName="min-w-0 flex-1"
              />
            )}
          </form.AppField>
          <form.AppField name="containerPrice">
            {(field) => (
              <field.Input
                label="Cena kontenera (zł)"
                type="number"
                showError
                fieldClassName="min-w-0 flex-1"
              />
            )}
          </form.AppField>
          <div aria-hidden className="size-9 shrink-0" />
        </div>
        <div className="flex items-end gap-2">
          <form.AppField name="defaultBigBagSupplierId">
            {(field) => (
              <FormBase label="Domyślny dostawca big bag" fieldClassName="min-w-0 flex-1">
                <SimpleSelect
                  id={field.name}
                  value={shownSupplier(field.state.value)}
                  onValueChange={field.handleChange}
                  options={supplierOptions}
                />
              </FormBase>
            )}
          </form.AppField>
          <form.AppField name="defaultContainerSupplierId">
            {(field) => (
              <FormBase label="Domyślny dostawca kontenera" fieldClassName="min-w-0 flex-1">
                <SimpleSelect
                  id={field.name}
                  value={shownSupplier(field.state.value)}
                  onValueChange={field.handleChange}
                  options={supplierOptions}
                />
              </FormBase>
            )}
          </form.AppField>
          <div aria-hidden className="size-9 shrink-0" />
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
      <FormFooter label="Zapisz" submittingLabel="Zapisywanie..." align="end" className="mt-6" />
    </FormShell>
  )
}
