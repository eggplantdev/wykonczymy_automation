'use client'

import { Check } from 'lucide-react'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { useTranslation } from '@/hooks/use-translation'

export function StageCompletedMark() {
  const gridDictionary = useTranslation('grid')
  const label = gridDictionary.t('stageCompleted')
  return (
    <SimpleTooltip content={label}>
      <span role="img" aria-label={label} className="text-chart-green inline-flex shrink-0">
        <Check className="size-3.5" aria-hidden />
      </span>
    </SimpleTooltip>
  )
}
