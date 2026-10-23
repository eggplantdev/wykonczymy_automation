'use client'

import { SlicePie } from '@/components/ui/slice-pie'
import type { AiAccuracyWindowT } from '@/lib/kosztorys/ai-accuracy'
import { formatPercent } from '@/lib/kosztorys/format'
import { formatCompactZloty } from './format'

export function AccuracyErrorTypePie({
  caption,
  window,
}: {
  caption: string
  window: AiAccuracyWindowT
}) {
  return (
    <SlicePie
      caption={caption}
      slices={[
        {
          id: 'extra',
          name: 'AI dodało, właściciel wyrzucił',
          value: window.extraZl,
          fill: 'var(--color-chart-pink)',
        },
        {
          id: 'qty',
          name: 'Obaj mają, inna ilość',
          value: window.qtyZl,
          fill: 'var(--color-chart-purple)',
        },
        {
          id: 'missed',
          name: 'AI pominęło, właściciel dodał',
          value: window.missedZl,
          fill: 'var(--color-chart-orange)',
        },
      ]}
      formatShare={formatPercent}
      formatValue={formatCompactZloty}
    />
  )
}
