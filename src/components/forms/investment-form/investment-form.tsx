'use client'

import { SelectItem } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { useFilePickIngest } from '@/components/forms/hooks/use-file-pick-ingest'
import { InvestmentAssetsField } from './investment-assets-field'
import { submitWithUploads } from '@/lib/media/submit-with-uploads'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { useStore } from '@/components/forms/hooks/form-hooks'
import { FormShell } from '@/components/forms/form-components/form-shell'
import FormFooter from '@/components/forms/form-components/form-footer'
import {
  investmentFormSchema,
  type InvestmentBillingFormValuesT,
  type InvestmentFormValuesT,
} from './investment-schema'
import { useInvestmentFormStore } from '@/stores/form-stores'
import type { InvestmentFormDataT } from './investment-schema'
import type { TemplateMetaT } from '@/lib/db/templates'
import type { ActionResultT } from '@/types/action'
import { isLockedStatus } from '@/lib/constants/investment-lock'
import { INVESTMENT_STATUS_LABELS, INVESTMENT_STATUSES } from '@/lib/constants/investment-status'
import {
  INVESTMENT_CLIENT_TYPE_LABELS,
  INVESTMENT_CLIENT_TYPES,
} from '@/lib/constants/investment-client-type'

// Hidden fields still hold whatever was typed before a switch — drop them so the record keeps only
// what the form shows.
function visibleBilling(billing: InvestmentBillingFormValuesT): InvestmentBillingFormValuesT {
  const isPerson = billing.clientType === 'person'
  const isCompany = billing.clientType === 'company'
  return {
    clientType: billing.clientType,
    firstName: isPerson ? billing.firstName : '',
    lastName: isPerson ? billing.lastName : '',
    companyName: isCompany ? billing.companyName : '',
    nip: isCompany ? billing.nip : '',
    representative: isCompany ? billing.representative : '',
    sameAsSite: billing.sameAsSite,
    street: billing.sameAsSite ? '' : billing.street,
    postalCode: billing.sameAsSite ? '' : billing.postalCode,
    city: billing.sameAsSite ? '' : billing.city,
    country: billing.sameAsSite ? '' : billing.country,
  }
}

type InvestmentFormPropsT = {
  formId: string
  defaultValues: InvestmentFormValuesT
  action: (data: InvestmentFormDataT) => Promise<ActionResultT>
  successMessage: string
  submitLabel: string
  submittingLabel: string
  onSubmitSuccess: () => void
  keepOpen?: boolean
  persistDraft?: boolean
  // Create-only seed-from-szablon picker; omitted on edit.
  presetOptions?: TemplateMetaT[]
  /** Create-only file picker. On edit the gallery on the investment's page owns `assets` — routing
   * them through the update action would send an empty list and wipe what is already attached. */
  collectAssets?: boolean
  assetsInvestmentId?: number
  onEnteredCompleted?: (data: InvestmentFormDataT) => void
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
  collectAssets,
  assetsInvestmentId,
  onEnteredCompleted,
}: InvestmentFormPropsT) {
  // Set by the action, consumed after `onSubmitSuccess`: the prompt opens through the shared dialog
  // store, so opening it before this dialog's own close would be undone by that close.
  const entersCompleted = (status: string) =>
    isLockedStatus(status) && !isLockedStatus(defaultValues.status)
  const { files, isIngesting, inputKey, fileInputProps, reset: resetFiles } = useFilePickIngest()

  const { form, reset, submitConfirm } = useManagedForm<InvestmentFormValuesT, InvestmentFormDataT>(
    {
      formId,
      useFormStore: useInvestmentFormStore,
      schema: investmentFormSchema,
      defaultValues,
      keepOpen,
      successMessage,
      onSubmitSuccess,
      onSaved: (data) => {
        if (entersCompleted(data.status) && !data.reviewRequested) onEnteredCompleted?.(data)
      },
      persistDraft,
      onReset: resetFiles,
      action: async (data) => {
        if (!collectAssets) return action(data)

        // Backstop to the disabled submit button, which Enter bypasses: a file still ingesting is
        // not in `files` yet, so the inwestycja would save without its zdjęcia.
        if (isIngesting) {
          return { success: false, error: 'Poczekaj na przetworzenie plików.' }
        }

        return submitWithUploads(files, (assets) => action({ ...data, assets }))
      },
      confirmBeforeSubmit: (value) =>
        entersCompleted(value.status)
          ? {
              title: 'Zakończyć inwestycję?',
              description:
                'Zakończona inwestycja jest tylko do odczytu — nikt nie dopisze transakcji ani nie zmieni kosztorysu. Odblokować może ją wyłącznie właściciel lub administrator, ustawiając status z powrotem na „Aktywna".',
              confirmLabel: 'Zakończ',
            }
          : null,
      toData: (value) => ({
        name: value.name,
        address: value.address,
        postalCode: value.postalCode,
        city: value.city,
        country: value.country,
        phone: value.phone,
        email: value.email,
        contactPerson: value.contactPerson,
        billing: visibleBilling(value.billing),
        notes: value.notes,
        reviewRequested: value.reviewRequested,
        status: value.status,
        presetId: value.presetId,
      }),
    },
  )
  const clientType = useStore(form.store, (s) => s.values.billing.clientType)
  const isBillingSameAsSite = useStore(form.store, (s) => s.values.billing.sameAsSite)

  return (
    <>
      <FormShell form={form} onReset={reset}>
        <FieldGroup>
          <form.AppField name="name">
            {(field) => <field.Input label="Nazwa" placeholder="Nazwa inwestycji" showError />}
          </form.AppField>

          <form.AppField name="address">
            {(field) => (
              <field.Input label="Ulica i numer" placeholder="Adres inwestycji" showError />
            )}
          </form.AppField>

          <div className="grid gap-4 @md/field-group:grid-cols-2">
            <form.AppField name="postalCode">
              {(field) => <field.Input label="Kod pocztowy" placeholder="00-000" showError />}
            </form.AppField>
            <form.AppField name="city">
              {(field) => <field.Input label="Miejscowość" showError />}
            </form.AppField>
          </div>

          <form.AppField name="country">
            {(field) => <field.Input label="Kraj" showError />}
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

          <FieldSet className="gap-4">
            <FieldLegend>Dane do umowy / faktury</FieldLegend>

            <form.AppField name="billing.clientType">
              {(field) => (
                <field.Select label="Typ klienta" placeholder="— nie wybrano —" showError>
                  {INVESTMENT_CLIENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {INVESTMENT_CLIENT_TYPE_LABELS[type].pl}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>

            {clientType === 'person' && (
              <div className="grid gap-4 @md/field-group:grid-cols-2">
                <form.AppField name="billing.firstName">
                  {(field) => <field.Input label="Imię" showError />}
                </form.AppField>
                <form.AppField name="billing.lastName">
                  {(field) => <field.Input label="Nazwisko" showError />}
                </form.AppField>
              </div>
            )}

            {clientType === 'company' && (
              <>
                <form.AppField name="billing.companyName">
                  {(field) => <field.Input label="Nazwa firmy" showError />}
                </form.AppField>
                <div className="grid gap-4 @md/field-group:grid-cols-2">
                  <form.AppField name="billing.nip">
                    {(field) => <field.Input label="NIP" showError />}
                  </form.AppField>
                  <form.AppField name="billing.representative">
                    {(field) => (
                      <field.Input
                        label="Osoba reprezentująca"
                        placeholder="Imię i nazwisko"
                        showError
                      />
                    )}
                  </form.AppField>
                </div>
              </>
            )}

            <form.AppField name="billing.sameAsSite">
              {(field) => <field.Checkbox label="Adres taki sam jak adres inwestycji" />}
            </form.AppField>

            {!isBillingSameAsSite && (
              <>
                <form.AppField name="billing.street">
                  {(field) => <field.Input label="Ulica i numer" showError />}
                </form.AppField>
                <div className="grid gap-4 @md/field-group:grid-cols-2">
                  <form.AppField name="billing.postalCode">
                    {(field) => <field.Input label="Kod pocztowy" placeholder="00-000" showError />}
                  </form.AppField>
                  <form.AppField name="billing.city">
                    {(field) => <field.Input label="Miejscowość" showError />}
                  </form.AppField>
                </div>
                <form.AppField name="billing.country">
                  {(field) => <field.Input label="Kraj" showError />}
                </form.AppField>
              </>
            )}
          </FieldSet>

          <form.AppField name="notes">
            {(field) => (
              <field.Textarea label="Notatki" placeholder="Notatki..." rows={3} showError />
            )}
          </form.AppField>

          <form.AppField name="reviewRequested">
            {(field) => (
              <field.Checkbox
                label="Prośba o opinię wysłana"
                description="Zaznacz jeśli wysłałeś już do inwestora prośbę o opinię w google"
              />
            )}
          </form.AppField>

          {/* The two columns follow the dialog's width, and the dialog is narrower than the viewport
              at which `sm:` would already have fired. */}
          <div className="grid gap-4 @md/field-group:grid-cols-2">
            <form.AppField name="status">
              {(field) => (
                <field.Select label="Status" showError>
                  {INVESTMENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {INVESTMENT_STATUS_LABELS[status].pl}
                    </SelectItem>
                  ))}
                </field.Select>
              )}
            </form.AppField>

            {collectAssets && (
              <FileInput key={inputKey} label="Zdjęcia i pliki" multiple {...fileInputProps} />
            )}
            {assetsInvestmentId !== undefined && (
              <InvestmentAssetsField investmentId={assetsInvestmentId} />
            )}
          </div>

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

        <FormFooter
          label={submitLabel}
          submittingLabel={submittingLabel}
          className="mt-6"
          disabled={isIngesting}
          awaitingAnswer={submitConfirm.open}
        />
      </FormShell>

      <ConfirmDialog {...submitConfirm} />
    </>
  )
}
