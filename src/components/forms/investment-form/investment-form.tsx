'use client'

import { SelectItem } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FieldGroup } from '@/components/ui/field'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import { investmentFormSchema, type InvestmentFormValuesT } from './investment-schema'
import { useInvestmentFormStore } from '@/stores/form-stores'
import type { InvestmentFormDataT } from './investment-schema'
import type { PresetMetaT } from '@/lib/db/presets'
import type { ActionResultT } from '@/types/action'
import { isLockedStatus } from '@/lib/constants/investment-lock'

type InvestmentFormPropsT = {
  formId: string
  defaultValues: InvestmentFormValuesT
  action: (data: InvestmentFormDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  /** False on the edit dialogs — see `useManagedForm`. */
  persistDraft?: boolean
  // Create-only seed-from-szablon picker; omitted on edit.
  presetOptions?: PresetMetaT[]
}

export function InvestmentForm({
  formId,
  defaultValues,
  action,
  successMessage,
  submitLabel,
  submittingLabel,
  onSubmitSuccess,
  keepOpen,
  persistDraft,
  presetOptions,
}: InvestmentFormPropsT) {
  const { form, reset, submitConfirm } = useManagedForm<InvestmentFormValuesT, InvestmentFormDataT>(
    {
      formId,
      useFormStore: useInvestmentFormStore,
      schema: investmentFormSchema,
      defaultValues,
      keepOpen,
      successMessage,
      onSubmitSuccess,
      action,
      persistDraft,
      // Only on the way IN, and only from another status: „Zakończona" is a one-way door for everyone
      // but właściciel/admin, so the person closing the investment is told what they are giving up
      // before the write, not by a refusal afterwards.
      confirmBeforeSubmit: (value) =>
        isLockedStatus(value.status) && !isLockedStatus(defaultValues.status)
          ? {
              title: 'Zakończyć inwestycję?',
              description:
                'Zakończona inwestycja jest tylko do odczytu — nikt nie dopisze transakcji ani nie zmieni kosztorysu. Odblokować może ją wyłącznie właściciel lub administrator, ustawiając status z powrotem na „Aktywna".',
              confirmLabel: 'Zakończ',
              cancelLabel: 'Anuluj',
            }
          : null,
      toData: (value) => ({
        name: value.name,
        address: value.address,
        phone: value.phone,
        email: value.email,
        contactPerson: value.contactPerson,
        notes: value.notes,
        review: value.review,
        status: value.status,
        presetId: value.presetId,
      }),
    },
  )

  return (
    <>
      <FormShell form={form} onReset={reset}>
        <FieldGroup>
          <form.AppField name="name">
            {(field) => <field.Input label="Nazwa" placeholder="Nazwa inwestycji" showError />}
          </form.AppField>

          <form.AppField name="address">
            {(field) => <field.Input label="Adres" placeholder="Adres inwestycji" showError />}
          </form.AppField>

          <form.AppField name="phone">
            {(field) => <field.Input label="Telefon" placeholder="Numer telefonu" showError />}
          </form.AppField>

          <form.AppField name="email">
            {(field) => (
              <field.Input label="Email" type="email" placeholder="Adres email" showError />
            )}
          </form.AppField>

          <form.AppField name="contactPerson">
            {(field) => (
              <field.Input label="Osoba kontaktowa" placeholder="Imię i nazwisko" showError />
            )}
          </form.AppField>

          <form.AppField name="notes">
            {(field) => (
              <field.Textarea label="Notatki" placeholder="Notatki..." rows={3} showError />
            )}
          </form.AppField>

          <form.AppField name="review">
            {(field) => (
              <field.Textarea label="Opinia" placeholder="Opinia..." rows={3} showError />
            )}
          </form.AppField>

          <form.AppField name="status">
            {(field) => (
              <field.Select label="Status" showError>
                <SelectItem value="planowana">Planowana</SelectItem>
                <SelectItem value="active">Aktywna</SelectItem>
                <SelectItem value="completed">Zakończona</SelectItem>
              </field.Select>
            )}
          </form.AppField>

          {presetOptions && presetOptions.length > 0 && (
            <form.AppField name="presetId">
              {(field) => (
                <field.Select
                  label="Kosztorys z szablonu"
                  placeholder="— pusty kosztorys —"
                  showError
                >
                  {presetOptions.map((preset) => (
                    <SelectItem key={preset.id} value={String(preset.id)}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>
          )}
        </FieldGroup>

        <FormFooter label={submitLabel} submittingLabel={submittingLabel} className="mt-6" />
      </FormShell>

      <ConfirmDialog {...submitConfirm} />
    </>
  )
}
