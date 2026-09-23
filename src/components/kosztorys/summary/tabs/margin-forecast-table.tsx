'use client'

import { faceValue } from '@/lib/kosztorys/summary-economics'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'
import { MARGIN_TABLE_COLS } from '@/components/kosztorys/summary/tabs/margin-table-cols'
import { Checkbox } from '@/components/ui/checkbox'
import { Description } from '@/components/ui/description'
import { PLANE_LABELS, RATE_LABELS } from '@/lib/kosztorys/constants'
import type { MarginForecastT } from '@/lib/kosztorys/margin-forecast'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

const DESCRIPTION =
  'Prognoza czyli przedmiar w cenie dla inwestora minus przedmiar w stawce wybranej ekipy. ' +
  'Liczy się z pełnej ceny bez rabatu, straty ani materiałów wliczonych w inwestycje. ' +
  'Tam gdzie materiał jest wliczony w cenę dla inwestora, przedmiar niesie jego przychód, ale nie ' +
  'jego koszt — prognoza jest więc marżą przed materiałem i leży wyżej niż marża rzeczywista, ' +
  'nawet przy w pełni wykonanym zakresie.'

type PropsT = {
  forecast: MarginForecastT
  plane: ToolPlaneT
  onPlaneChange: (plane: ToolPlaneT) => void
}

export function MarginForecastTable({ forecast, plane, onPlaneChange }: PropsT) {
  return (
    <>
      <Description className="max-w-xl" size="xs">
        {DESCRIPTION}
      </Description>
      <SummaryTable cols={MARGIN_TABLE_COLS} className="w-fit">
        <SummaryHeaderCell variant="label">Prognoza</SummaryHeaderCell>
        <SummaryHeaderCell>Kwota</SummaryHeaderCell>

        <SummaryRow label="Wartość przedmiaru" line={faceValue(forecast.clientNet)} axis="net" />
        <SummaryRow
          label={`Należne wykonawcom — ${RATE_LABELS[plane].toLowerCase()}`}
          hint="Prognozowana kwota do zapłaty podwykonawcom."
          line={faceValue(-forecast.subcontractorNet)}
          axis="net"
          discount
        />
        <SummaryRow
          label="Marża prognozowana"
          line={faceValue(forecast.margin)}
          axis="net"
          bold
          danger={forecast.margin < 0}
        />
      </SummaryTable>
      {/* Belongs to the forecast alone: the actual margin prices each etap at the plane the etap
          itself carries, so a scenario switch beside it would imply an effect it does not have. */}
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={plane === 'own_tools'}
          onCheckedChange={(state) => onPlaneChange(state === true ? 'own_tools' : 'w_tools')}
        />
        {PLANE_LABELS.own_tools}
      </label>
    </>
  )
}
