'use client'

import { costPieSlices } from '@/lib/kosztorys/chart-slices'
import { SlicePie } from '@/components/kosztorys/slice-pie'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

// Cost split: robocizna (executed) + per-category materiały. No toggle — always executed, matching the
// sheet's r463. Same figures the summary table lists, so chart and table agree by construction.
export function CostStructurePie({
  sumaPracNet,
  materialyBreakdown,
}: {
  sumaPracNet: number
  materialyBreakdown: MaterialyBreakdownRowT[]
}) {
  return (
    <SlicePie
      caption={<figcaption className="text-muted-foreground text-xs">Struktura kosztów</figcaption>}
      slices={costPieSlices(sumaPracNet, materialyBreakdown)}
    />
  )
}
