'use client'

import { Description } from '@/components/ui/description'
import { formatPercentPrecise } from '@/lib/kosztorys/format'

type PropsT = {
  // Both figures are netto over the FULL dataset — the counter answers for the whole kosztorys, so the
  // caller must not pass the filtered/sorted view.
  doneNet: number
  plannedNet: number
}

export function KosztorysProgressCounter({ doneNet, plannedNet }: PropsT) {
  // No przedmiar → nothing to divide by, so the whole counter is meaningless — render nothing.
  if (plannedNet <= 0) return null

  const ratio = doneNet / plannedNet
  // Bar caps at full; the percent text still shows the real >100% overrun.
  const barPct = Math.min(ratio, 1) * 100

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs tabular-nums">
          Postęp prac: {formatPercentPrecise(ratio)}
        </span>
        <span
          role="progressbar"
          aria-label="Wykonano"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(barPct)}
          className="bg-border h-1.5 w-24 shrink-0 rounded-full"
        >
          {/* Dynamic percentage width — the one value Tailwind can't express as a token. */}
          <span
            className="from-chart-green via-chart-teal to-chart-turquoise progress-glow block h-full rounded-full bg-linear-to-r transition-[width]"
            style={{ width: `${barPct}%` }}
          />
        </span>
      </div>
      <Description className="text-xs">
        Ile zostało wykonane względem pierwotnych estymat z wyceny projektu
      </Description>
    </div>
  )
}
