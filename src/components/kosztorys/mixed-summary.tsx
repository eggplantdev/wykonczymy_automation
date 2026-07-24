import { computeMixedSettlement } from '@/lib/kosztorys/summary-economics'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary-row'
import { summaryMoneyCols } from '@/components/kosztorys/summary-axis'

type PropsT = {
  // Robocizna wartość netto — already post-rabat (Suma prac po rabacie).
  laborCostsNetFromKosztorys: number
  // Materiały brutto — netto is derived via the same deriveMaterialsNet/reduction switch as elsewhere.
  materialsGross: number
  vatRate: number
  deriveMaterialsNet: boolean
  materialsReduction: number
  // Wpłaty split by VAT plane: NET (+ unmarked) settle the netto section, GROSS the brutto section.
  paidNet: number
  paidGross: number
  // Rabat taken off the executed robocizna (net zł) — informational only; already inside robocizna netto.
  rabatAmount: number
}

// Tryb mieszany: one vertical netto→brutto tor (no netto/brutto columns). The netto section resolves
// Łącznie − wpłaty netto → „Do rozliczenia netto"; that remainder is grossed onto the invoice, where
// wpłaty brutto pay it down → „Do zapłaty brutto". Rabat is a trailing informational netto row — it's
// already baked into robocizna netto, so it never deducts twice.
export function MixedSummary({
  laborCostsNetFromKosztorys,
  materialsGross,
  vatRate,
  deriveMaterialsNet,
  materialsReduction,
  paidNet,
  paidGross,
  rabatAmount,
}: PropsT) {
  const settlement = computeMixedSettlement(
    laborCostsNetFromKosztorys,
    materialsGross,
    vatRate,
    paidNet,
    paidGross,
    deriveMaterialsNet,
    materialsReduction,
  )
  const vatPercent = Math.round(vatRate * 100)
  const cols = summaryMoneyCols('net')
  const money = (amount: number) => ({ net: amount, gross: amount })

  return (
    <div className="flex w-fit flex-col gap-8 self-start">
      <SummaryTable cols={cols} className="w-fit">
        <SummaryHeaderCell variant="label">Rozliczenie mieszane</SummaryHeaderCell>
        <SummaryHeaderCell>Kwota netto</SummaryHeaderCell>

        <SummaryRow label="Robocizna" line={money(settlement.robocizna)} axis="net" />
        <SummaryRow label="Materiały" line={money(settlement.materialy)} axis="net" />
        <SummaryRow label="Łącznie" line={money(settlement.combinedNet)} axis="net" emphasize />
        <SummaryRow label="Wpłaty netto" line={money(settlement.paidNet)} axis="net" discount />
        <SummaryRow
          label="Do zapłaty netto"
          hint="Łącznie netto − wpłaty netto"
          line={money(settlement.doRozliczeniaNet)}
          axis="net"
          bold
        />
      </SummaryTable>

      <SummaryTable cols={cols} className="w-fit">
        <SummaryHeaderCell variant="label">Rozliczenie fakturą</SummaryHeaderCell>
        <SummaryHeaderCell>Kwota brutto</SummaryHeaderCell>

        <SummaryRow
          label="Reszta brutto"
          hint={`Do rozliczenia netto + VAT ${vatPercent}%`}
          line={money(settlement.resztaGross)}
          axis="net"
        />
        <SummaryRow label="Wpłaty brutto" line={money(settlement.paidGross)} axis="net" discount />
        <SummaryRow
          label="Do zapłaty brutto"
          hint="Reszta brutto − wpłaty brutto"
          line={money(settlement.doZaplatyGross)}
          axis="net"
          bold
          danger={settlement.doZaplatyGross > 0}
        />
      </SummaryTable>

      {rabatAmount > 0 && (
        <SummaryTable cols={cols} className="w-fit">
          <SummaryRow label="Udzielono rabatu na kwotę" line={money(rabatAmount)} axis="net" />
        </SummaryTable>
      )}
    </div>
  )
}
