'use client'

import { Fragment } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { DialogActions } from '@/components/ui/dialog-actions'
import { Description } from '@/components/ui/description'
import { SelectItem } from '@/components/ui/select'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { useAppForm } from '@/components/forms/hooks/form-hooks'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { buildProtocolHtml } from '@/lib/kosztorys/acceptance-protocol/build-protocol-html'
import { ACCEPTANCE_KIND_LABELS } from '@/lib/kosztorys/acceptance-protocol/constants'
import {
  protocolFormDefaults,
  protocolPrefillKey,
} from '@/lib/kosztorys/acceptance-protocol/form-defaults'
import {
  protocolScopeRows,
  scopeQuantityText,
} from '@/lib/kosztorys/acceptance-protocol/scope-rows'
import {
  protocolSettlement,
  protocolSettlementLines,
} from '@/lib/kosztorys/acceptance-protocol/settlement'
import type {
  AcceptanceKindT,
  AcceptanceProtocolFormT,
} from '@/lib/kosztorys/acceptance-protocol/types'
import type { MaterialsT } from '@/lib/kosztorys/summary-economics'
import { EditInvestmentPrefill } from '@/components/dialogs/edit-investment-prefill'
import { formatPLN } from '@/lib/utils/format-currency'
import { warsawToday } from '@/lib/utils/days'
import { openPrintWindow, writeAndPrint } from '@/lib/utils/print-window'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { toastMessage } from '@/lib/utils/toast'
import type { InvestmentWithDetailsT } from '@/types/reference-data'
import type { DepositTransactionRowT } from '@/types/transfers'

export type AcceptanceProtocolSourceT = {
  investment: InvestmentWithDetailsT
  materials: MaterialsT
  depositTransactions: DepositTransactionRowT[]
  lossAmount: number
}

const KIND_OPTIONS = Object.entries(ACCEPTANCE_KIND_LABELS) as [AcceptanceKindT, string][]

export function AcceptanceProtocolDialog({ source }: { source: AcceptanceProtocolSourceT }) {
  const { open, setOpen } = useKosztorysActions().acceptanceProtocol

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-dialog-lg">
        <DialogHeader
          title="Protokół odbioru prac"
          description="Sprawdź dane i wygeneruj protokół do druku lub zapisu jako PDF. Puste pola zostają do wypełnienia długopisem."
        />
        {/* Remounted when the investment's prefill changes, so a save in „Edytuj dane inwestycji”
            lands in the protocol fields. */}
        <AcceptanceProtocolBody
          key={protocolPrefillKey(source.investment)}
          source={source}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function AcceptanceProtocolBody({
  source,
  onClose,
}: {
  source: AcceptanceProtocolSourceT
  onClose: () => void
}) {
  const { rows, stages, laborCostsNet, discountNetFromKosztorys, tree } =
    useKosztorysEditorContext()
  const { investment } = source
  const scope = protocolScopeRows(rows, stages)
  const settlement = protocolSettlement({
    ...source,
    laborCostsNet,
    discountAmount: discountNetFromKosztorys,
    vatRate: tree.vatRate,
    settlementMode: tree.settlementMode,
    materialsNetRate: tree.materialsNetRate,
  })
  const form = useAppForm({
    defaultValues: protocolFormDefaults({ investment, today: warsawToday() }),
  })
  function handleGenerate() {
    const values: AcceptanceProtocolFormT = form.state.values
    const target = openPrintWindow(`Protokół odbioru prac — ${values.clientName}`)
    if (!target) {
      toastMessage('Przeglądarka zablokowała okno wydruku', 'error')
      return
    }
    try {
      writeAndPrint(
        target,
        buildProtocolHtml({
          form: values,
          scope,
          settlement,
          logoUrl: `${window.location.origin}/logo-wykonczymy.png`,
        }),
      )
    } catch {
      target.close()
      toastMessage('Nie udało się przygotować wydruku', 'error')
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.AppField name="kind">
          {(field) => (
            <field.Select label="Rodzaj odbioru">
              {KIND_OPTIONS.map(([kind, label]) => (
                <SelectItem key={kind} value={kind}>
                  {label}
                </SelectItem>
              ))}
            </field.Select>
          )}
        </form.AppField>
        <form.AppField name="place">{(field) => <field.Input label="Miejscowość" />}</form.AppField>
        <form.AppField name="issueDate">
          {(field) => <field.DatePicker label="Data sporządzenia" />}
        </form.AppField>
        <form.AppField name="acceptanceDate">
          {(field) => <field.DatePicker label="Data odbioru" />}
        </form.AppField>
        <form.AppField name="readinessDate">
          {(field) => <field.DatePicker label="Data zgłoszenia gotowości" />}
        </form.AppField>
        <form.AppField name="paymentDueDate">
          {(field) => <field.DatePicker label="Termin zapłaty" />}
        </form.AppField>
        <form.AppField name="clientName">
          {(field) => <field.Input label="Zamawiający" />}
        </form.AppField>
        <form.AppField name="siteAddress">
          {(field) => <field.Input label="Miejsce wykonania prac (adres)" />}
        </form.AppField>
        <EditInvestmentPrefill investment={investment} className="sm:col-span-2">
          Zamawiający i adres pochodzą z inwestycji — po zapisie protokół wypełni się ponownie.
        </EditInvestmentPrefill>
        <form.AppField name="contractorName">
          {(field) => <field.Input label="Wykonawca" />}
        </form.AppField>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Zakres prac ({scope.length})</h3>
        {scope.length === 0 ? (
          <Description tone="error">
            Żadna pozycja nie ma jeszcze wykonanej pracy — uzupełnij etapy w kosztorysie.
          </Description>
        ) : (
          <SummaryTable cols={`2.5rem minmax(0, 1fr) ${SUMMARY_VALUE_COL}`}>
            <SummaryHeaderCell variant="label">Lp.</SummaryHeaderCell>
            <SummaryHeaderCell variant="label">Prace</SummaryHeaderCell>
            <SummaryHeaderCell>Ilość i jedn.</SummaryHeaderCell>
            {scope.map((row, index) => (
              <Fragment key={index}>
                <SummaryLabelCell>{index + 1}</SummaryLabelCell>
                <SummaryLabelCell>{row.description}</SummaryLabelCell>
                <SummaryValueCell>{scopeQuantityText(row)}</SummaryValueCell>
              </Fragment>
            ))}
          </SummaryTable>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Rozliczenie (netto)</h3>
        <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="w-fit">
          {protocolSettlementLines(settlement).map(({ label, amount, emphasis }) => {
            const weight = emphasis === 'total' ? 'bold' : emphasis ? 'medium' : undefined
            // Red only on what is still owed, rounded first so a bill settled to the grosz stays black.
            const tone = emphasis === 'total' && roundToCents(amount) > 0 ? 'error' : undefined
            return [
              <SummaryLabelCell key={`${label}-label`} weight={weight}>
                {label}
              </SummaryLabelCell>,
              <SummaryValueCell key={`${label}-value`} weight={weight} tone={tone}>
                {formatPLN(amount)}
              </SummaryValueCell>,
            ]
          })}
        </SummaryTable>
      </section>

      <DialogActions
        confirmLabel="Generuj"
        onConfirm={handleGenerate}
        onCancel={onClose}
        confirmDisabled={scope.length === 0}
      />
    </>
  )
}
