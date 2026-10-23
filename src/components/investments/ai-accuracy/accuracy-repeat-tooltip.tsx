import { ChartTooltipFrame } from '@/components/ui/chart'
import type { AiAccuracyT } from '@/lib/kosztorys/ai-accuracy'
import { formatPLN } from '@/lib/utils/format-currency'

type PropsT = {
  active?: boolean
  payload?: { payload: AiAccuracyT['repeats'][number] }[]
}

export function AccuracyRepeatTooltip({ active, payload }: PropsT) {
  const repeat = payload?.[0]?.payload
  if (!active || !repeat) return null

  return (
    <ChartTooltipFrame className="max-w-80 min-w-56 gap-2 px-3 py-2.5">
      <span className="text-sm font-medium">{repeat.pozycja}</span>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Błąd razem</dt>
        <dd className="font-semibold tabular-nums">{formatPLN(repeat.wrongZl)}</dd>
        <dt className="text-muted-foreground">Błąd w ilu przypadkach</dt>
        <dd className="tabular-nums">{repeat.wrongInCases}</dd>
        <dt className="text-muted-foreground">Poprawki z wpisanym powodem</dt>
        <dd className="tabular-nums">{repeat.reasonsWritten}</dd>
      </dl>
    </ChartTooltipFrame>
  )
}
