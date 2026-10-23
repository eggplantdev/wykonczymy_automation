import { Panel } from '@/components/ui/panel'
import { Description } from '@/components/ui/description'
import { SUBSECTION_TITLE_CLASS } from '@/components/ui/section-header'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import type { AiAccuracyT } from '@/lib/kosztorys/ai-accuracy'
import { formatPLN } from '@/lib/utils/format-currency'
import { cn } from '@/lib/utils/cn'
import { accuracyBand } from './accuracy-bands'
import { formatWholePercent } from './format'

const SUM_COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`

type ExampleT = NonNullable<AiAccuracyT['example']>

export function AccuracyMethodCompare({ example }: { example: ExampleT }) {
  const methods = [
    {
      title: 'Sposób 1: porównujemy tylko cenę końcową',
      rows: [
        { label: 'Kosztorys właściciela', zl: example.ownerZl },
        { label: 'Kosztorys AI', zl: example.aiZl },
      ],
      totalLabel: 'Różnica',
      totalZl: example.priceGapZl,
      percent: example.priceMatchPercent,
      verdict: 'zgodności. Wygląda prawie idealnie… ale nie jest.',
    },
    {
      title: 'Sposób 2: sumujemy każdy błąd, pozycja po pozycji',
      rows: [
        { label: 'Pozycje, gdzie AI dało za dużo', zl: example.tooHighZl },
        { label: 'Pozycje, gdzie AI dało za mało', zl: example.tooLowZl },
      ],
      totalLabel: 'Wszystkie błędy razem',
      totalZl: example.wrongZl,
      percent: example.rightPercent,
      verdict: 'dobrze. To jest prawdziwy obraz.',
    },
  ]

  return (
    <div className="grid gap-4 pt-4">
      <Description withIcon={false} className="max-w-prose leading-relaxed">
        Pierwszy sprawdzony przypadek to {example.label}. W części pozycji AI wpisało za dużo, w
        części za mało.
      </Description>
      <div className="grid gap-4 sm:grid-cols-2">
        {methods.map((method) => (
          <Panel key={method.title} className="grid content-start gap-4 p-5">
            <h3 className={SUBSECTION_TITLE_CLASS}>{method.title}</h3>
            <SummaryTable cols={SUM_COLS}>
              {method.rows.flatMap((row) => [
                <SummaryCell key={`${row.label}-label`}>{row.label}</SummaryCell>,
                <SummaryCell key={`${row.label}-zl`} className="text-right">
                  {formatPLN(row.zl)}
                </SummaryCell>,
              ])}
              <SummaryCell weight="medium">{method.totalLabel}</SummaryCell>
              <SummaryCell className="text-right" weight="medium">
                {formatPLN(method.totalZl)}
              </SummaryCell>
            </SummaryTable>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={cn('text-4xl font-bold tabular-nums', accuracyBand(method.percent).text)}
              >
                {formatWholePercent(method.percent)}
              </span>
              <span className="text-muted-foreground text-sm">{method.verdict}</span>
            </p>
          </Panel>
        ))}
      </div>
      <p className="max-w-prose text-sm leading-relaxed">
        <b>Skąd ta różnica:</b> w sposobie 1 „za dużo” i „za mało” się znoszą, więc cena końcowa
        wygląda dobrze, choć pozycje się nie zgadzają. <b>Dlatego zawsze liczymy sposobem 2.</b>
      </p>
    </div>
  )
}
