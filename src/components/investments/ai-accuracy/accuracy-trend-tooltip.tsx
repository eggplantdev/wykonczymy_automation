import { ChartTooltipFrame } from '@/components/ui/chart'
import { AI_ACCURACY_WINDOW, type AiAccuracyCaseScoreT } from '@/lib/kosztorys/ai-accuracy'
import { formatPLN } from '@/lib/utils/format-currency'
import { cn } from '@/lib/utils/cn'
import { accuracyBand } from './accuracy-bands'
import { formatWholePercent } from './format'

type PropsT = {
  active?: boolean
  payload?: { payload: AiAccuracyCaseScoreT }[]
}

export function AccuracyTrendTooltip({ active, payload }: PropsT) {
  const score = payload?.[0]?.payload
  if (!active || !score) return null
  const band = accuracyBand(score.rightPercent)

  return (
    <ChartTooltipFrame className="min-w-56 gap-2 px-3 py-2.5">
      <span className="text-sm font-medium">{score.label}</span>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground flex items-center gap-2">
          <span className={cn('size-2.5 rounded-xs', band.swatch)} />
          AI miało dobrze
        </dt>
        <dd className={cn('font-semibold tabular-nums', band.text)}>
          {formatWholePercent(score.rightPercent)}
        </dd>
        <dt className="text-muted-foreground flex items-center gap-2">
          <span className="bg-chart-purple h-0.5 w-2.5 rounded-full" />
          Średnia z {AI_ACCURACY_WINDOW} ostatnich
        </dt>
        <dd className="tabular-nums">{formatWholePercent(score.rollingPercent)}</dd>
        <dt className="text-muted-foreground pl-4.5">Błędy AI</dt>
        <dd className="tabular-nums">{formatPLN(score.wrongZl)}</dd>
      </dl>
    </ChartTooltipFrame>
  )
}
