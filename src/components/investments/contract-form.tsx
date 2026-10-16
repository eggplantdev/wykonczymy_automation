'use client'

import { Fragment, use } from 'react'
import { MapPin, UserRound } from 'lucide-react'
import { DialogActions } from '@/components/ui/dialog-actions'
import { Description } from '@/components/ui/description'
import { Separator } from '@/components/ui/separator'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { EditInvestmentPrefill } from '@/components/dialogs/edit-investment-prefill'
import { buildContractHtml } from '@/lib/investments/contract/build-contract-html'
import { contractFormDefaults } from '@/lib/investments/contract/form-defaults'
import type { ContractFormT } from '@/lib/investments/contract/types'
import { warsawToday } from '@/lib/utils/days'
import { openPrintWindow, writeAndPrint } from '@/lib/utils/print-window'
import { toastMessage } from '@/lib/utils/toast'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

const ADDRESS_GROUPS = [
  { name: 'clientAddress', title: 'Dane Zamawiającego', icon: UserRound },
  { name: 'siteAddress', title: 'Adres inwestycji', icon: MapPin },
] as const

type PropsT = {
  investment: InvestmentWithDetailsT
  plannedNet: Promise<number | undefined>
  onClose: () => void
}

export function ContractForm({ investment, plannedNet, onClose }: PropsT) {
  const loadedPlannedNet = use(plannedNet)
  const defaults = contractFormDefaults({
    investment,
    today: warsawToday(),
    plannedNet: loadedPlannedNet,
  })
  const form = useAppForm({ defaultValues: defaults })

  function handleGenerate() {
    const values: ContractFormT = form.state.values
    const target = openPrintWindow(`Umowa — ${values.clientName}`)
    if (!target) {
      toastMessage('Przeglądarka zablokowała okno wydruku', 'error')
      return
    }
    try {
      writeAndPrint(target, buildContractHtml({ form: values }))
    } catch {
      target.close()
      toastMessage('Nie udało się przygotować wydruku', 'error')
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
          <form.AppField name="number">
            {(field) => <field.Input label="Numer umowy" />}
          </form.AppField>
          <form.AppField name="signDate">
            {(field) => <field.DatePicker label="Data zawarcia" />}
          </form.AppField>
          <form.AppField name="place">
            {(field) => <field.Input label="Miejsce zawarcia" />}
          </form.AppField>
        </div>
        <form.AppField name="startWindow">
          {(field) => <field.Input label="Termin rozpoczęcia (pomiędzy)" />}
        </form.AppField>
        <form.AppField name="duration">
          {(field) => <field.Input label="Czas trwania prac" />}
        </form.AppField>
        <form.AppField name="supervisors">
          {(field) => <field.Input label="Osoby odpowiedzialne za nadzór" />}
        </form.AppField>
        <div className="flex flex-col gap-1">
          <form.AppField name="plannedNet">
            {(field) => <field.Input label="Kwota netto około (zł)" />}
          </form.AppField>
          {loadedPlannedNet === undefined && (
            <Description size="xs" tone="error">
              Nie udało się wczytać kwoty z kosztorysu — wpisz ją ręcznie.
            </Description>
          )}
        </div>
        <div className="flex flex-col gap-4 sm:col-span-2">
          {ADDRESS_GROUPS.map(({ name, title, icon }) => (
            <Fragment key={name}>
              <Separator orientation="horizontal" className="mt-4 mb-2" />
              <CollapsibleSection
                title={title}
                icon={icon}
                size="sm"
                withSeparator={false}
                defaultOpen={false}
              >
                <div className="flex flex-col gap-4">
                  <EditInvestmentPrefill investment={investment}>
                    Zamawiający i adresy pochodzą z inwestycji — po zapisie umowa wypełni się
                    ponownie.
                  </EditInvestmentPrefill>
                  {name === 'clientAddress' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <form.AppField name="clientName">
                        {(field) => <field.Input label="Zamawiający" />}
                      </form.AppField>
                      {!defaults.isCompany && (
                        <form.AppField name="clientPesel">
                          {(field) => <field.Input label="PESEL" />}
                        </form.AppField>
                      )}
                    </div>
                  )}
                  <form.AppField name={`${name}.street`}>
                    {(field) => <field.Input label="Ulica i numer" />}
                  </form.AppField>
                  <div className="grid gap-4 sm:grid-cols-5">
                    <form.AppField name={`${name}.postalCode`}>
                      {(field) => <field.Input label="Kod pocztowy" placeholder="00-000" />}
                    </form.AppField>
                    <div className="sm:col-span-2">
                      <form.AppField name={`${name}.city`}>
                        {(field) => <field.Input label="Miejscowość" />}
                      </form.AppField>
                    </div>
                    <div className="sm:col-span-2">
                      <form.AppField name={`${name}.country`}>
                        {(field) => <field.Input label="Kraj" />}
                      </form.AppField>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </Fragment>
          ))}
        </div>
      </div>

      <DialogActions confirmLabel="Generuj" onConfirm={handleGenerate} onCancel={onClose} />
    </>
  )
}
