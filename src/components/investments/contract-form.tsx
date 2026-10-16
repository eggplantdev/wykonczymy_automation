'use client'

import { use } from 'react'
import { DialogActions } from '@/components/ui/dialog-actions'
import { Description } from '@/components/ui/description'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { buildContractHtml } from '@/lib/investments/contract/build-contract-html'
import { contractFormDefaults } from '@/lib/investments/contract/form-defaults'
import type { ContractFormT } from '@/lib/investments/contract/types'
import { warsawToday } from '@/lib/utils/days'
import { openPrintWindow, writeAndPrint } from '@/lib/utils/print-window'
import { toastMessage } from '@/lib/utils/toast'
import type { InvestmentWithDetailsT } from '@/types/reference-data'

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
        <form.AppField name="number">
          {(field) => <field.Input label="Numer umowy" />}
        </form.AppField>
        <form.AppField name="signDate">
          {(field) => <field.DatePicker label="Data zawarcia" />}
        </form.AppField>
        <form.AppField name="place">{(field) => <field.Input label="Miejscowość" />}</form.AppField>
        <form.AppField name="clientName">
          {(field) => <field.Input label="Zamawiający" />}
        </form.AppField>
        {!defaults.isCompany && (
          <form.AppField name="clientPesel">
            {(field) => <field.Input label="PESEL" />}
          </form.AppField>
        )}
        <form.AppField name="clientAddress">
          {(field) => <field.Input label="Adres Zamawiającego" />}
        </form.AppField>
        <form.AppField name="siteAddress">
          {(field) => <field.Input label="Adres inwestycji" />}
        </form.AppField>
        <div className="flex items-center gap-3 sm:col-span-2">
          <EditInvestmentDialog investment={investment} triggerText="Edytuj dane inwestycji" />
          <Description size="xs" withIcon={false}>
            Zamawiający i adresy pochodzą z inwestycji — po zapisie umowa wypełni się ponownie.
          </Description>
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
      </div>

      <DialogActions confirmLabel="Generuj" onConfirm={handleGenerate} onCancel={onClose} />
    </>
  )
}
