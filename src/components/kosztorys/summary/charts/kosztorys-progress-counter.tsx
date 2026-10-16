'use client'

import { InfoTooltip } from '@/components/ui/info-tooltip'
import { formatPercent } from '@/lib/kosztorys/format'

type PropsT = {
  // Both figures are netto over the FULL dataset — the caller must not pass the filtered/sorted view.
  doneNet: number
  plannedNet: number
}

export function KosztorysProgressCounter({ doneNet, plannedNet }: PropsT) {
  if (plannedNet <= 0) return null

  const ratio = doneNet / plannedNet
  const barPct = Math.min(ratio, 1) * 100

  // min-h-8 is the height a select trigger gives the other tabs' header rows; without it a row of
  // bare text sits shallower and the tab's top edge visibly shifts as you switch tabs.
  return (
    <div className="flex min-h-8 items-center gap-1.5">
      <span className="text-muted-foreground text-xs">Postęp prac</span>
      <span className="text-muted-foreground text-xs tabular-nums">{formatPercent(ratio)}</span>
      <span
        role="progressbar"
        aria-label="Wykonano"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(barPct)}
        className="bg-border h-1.5 w-24 shrink-0 rounded-full"
      >
        <span
          className="from-chart-green via-chart-teal to-chart-turquoise progress-glow block h-full rounded-full bg-linear-to-r transition-[width]"
          style={{ width: `${barPct}%` }}
        />
      </span>
      <InfoTooltip
        content="Ile zostało wykonane względem pierwotnych estymat z wyceny projektu"
        label="Więcej o: postęp prac"
      />
    </div>
  )
}
