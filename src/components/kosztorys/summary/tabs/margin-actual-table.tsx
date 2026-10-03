'use client'

import { faceValue } from '@/lib/kosztorys/summary-economics'
import {
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'
import { MARGIN_TABLE_COLS } from '@/components/kosztorys/summary/tabs/margin-table-cols'
import { Description } from '@/components/ui/description'
import { SUBCONTRACTOR_FIGURE_LABELS } from '@/lib/kosztorys/labels'
import { marginV2, subcontractorRemaining } from '@/lib/kosztorys/margin-v2'
import type { SubcontractorSettlementT } from '@/lib/kosztorys/subcontractor-due'
import type { InvestmentFinancialsT } from '@/types/investment-financials'

const DESCRIPTION =
  'Robocizna minus rabat minus suma wykonanej pracy, minus ' +
  'materiał wliczony w robociznę, stratę i premie. Koszt podwykonawców liczony z kosztorysu, a nie z wypłat — ile zrobiono, nie ile do tej pory wypłacono.'

// The crew block stands next to the margin, not in it: the margin costs the work the kosztorys
// credits, wypłaty are cash timing. Without this the two numbers look like a contradiction.
const PAYOUT_GAP_DESCRIPTION =
  'Poza marżą — ile ekipa dostała względem wykonanej pracy. Marża liczy wykonaną pracę, nie wypłaty.'

const WITHHELD_NOTE =
  'Etapy z wykonaną pracą, ale bez rozliczenia (z narzędziami / bez narzędzi), nie wchodzą do kosztu ekipy. Dopóki ich nie ustawisz, marża wyszłaby zawyżona o nieznaną kwotę.'

type PropsT = {
  /** Already rebased onto the reading the panel is on — see the tab's own note. */
  financials: InvestmentFinancialsT
  subcontractor: SubcontractorSettlementT
}

export function MarginActualTable({ financials, subcontractor }: PropsT) {
  const { totalLaborCosts, totalDiscount, totalLoss, totalBonus, totalSettled, totalPayouts } =
    financials
  const margin = marginV2(financials, subcontractor)
  const remaining = subcontractorRemaining(financials, subcontractor)

  return (
    <>
      <Description className="max-w-xl" size="xs">
        {DESCRIPTION}
      </Description>
      <SummaryTable cols={MARGIN_TABLE_COLS} className="w-fit">
        <SummaryHeaderCell variant="label">Marża rzeczywista</SummaryHeaderCell>
        <SummaryHeaderCell>Kwota</SummaryHeaderCell>

        <SummaryRow label="Robocizna" line={faceValue(totalLaborCosts)} axis="net" />
        {totalDiscount !== 0 && (
          <SummaryRow label="Rabat" line={faceValue(-totalDiscount)} axis="net" discount />
        )}
        {/* Named from the shared labels rather than a fresh string, so this row and the
            „Podwykonawcy" tab can never call one amount two things. */}
        <SummaryRow
          label={SUBCONTRACTOR_FIGURE_LABELS.due}
          line={faceValue(-subcontractor.due)}
          axis="net"
          discount
        />
        {totalSettled !== 0 && (
          <SummaryRow
            label="Materiały wliczone w robociznę"
            line={faceValue(-totalSettled)}
            axis="net"
            discount
          />
        )}
        {totalLoss !== 0 && (
          <SummaryRow label="Strata" line={faceValue(-totalLoss)} axis="net" discount />
        )}
        {totalBonus !== 0 && (
          <SummaryRow label="Premia" line={faceValue(-totalBonus)} axis="net" discount />
        )}
        {margin === null ? (
          // No amount at all — a zero-cost crew is a false statement, not a missing one.
          <>
            <SummaryLabelCell weight="bold">Marża</SummaryLabelCell>
            <SummaryValueCell weight="bold" note={{ text: WITHHELD_NOTE, tone: 'error' }}>
              Ustaw rozliczenie etapów
            </SummaryValueCell>
          </>
        ) : (
          <SummaryRow label="Marża" line={faceValue(margin)} axis="net" bold danger={margin < 0} />
        )}
      </SummaryTable>
      {/* Withheld on the same condition as the margin above: with an etap holding executed work
          and no rozliczenie, `due` is short by an unknown amount, and „Nadpłata" derived from it
          would name an overpayment that does not exist. */}
      {!subcontractor.hasUnconfirmedPlane &&
        (subcontractor.due !== 0 || totalPayouts !== 0 || totalBonus !== 0) && (
          <>
            <Description className="max-w-xl" size="xs">
              {PAYOUT_GAP_DESCRIPTION}
            </Description>
            <SummaryTable cols={MARGIN_TABLE_COLS} className="w-fit">
              <SummaryHeaderCell variant="label">Rozliczenie z ekipą</SummaryHeaderCell>
              <SummaryHeaderCell>Kwota</SummaryHeaderCell>

              <SummaryRow
                label={SUBCONTRACTOR_FIGURE_LABELS.due}
                line={faceValue(subcontractor.due)}
                axis="net"
              />
              {totalBonus !== 0 && (
                <SummaryRow
                  label={SUBCONTRACTOR_FIGURE_LABELS.bonus}
                  line={faceValue(totalBonus)}
                  axis="net"
                />
              )}
              <SummaryRow
                label={SUBCONTRACTOR_FIGURE_LABELS.payouts}
                line={faceValue(-totalPayouts)}
                axis="net"
                discount
              />
              <SummaryRow
                label={remaining < 0 ? 'Nadpłata' : SUBCONTRACTOR_FIGURE_LABELS.remaining}
                hint={
                  remaining < 0
                    ? 'Ekipa dostała więcej, niż jest warta wykonana praca — zaliczka przed robotą albo nieodhaczone etapy.'
                    : undefined
                }
                line={faceValue(remaining < 0 ? -remaining : remaining)}
                axis="net"
                bold
                danger={remaining < 0}
              />
            </SummaryTable>
          </>
        )}
    </>
  )
}
