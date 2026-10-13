'use client'

import { Check } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'

export function StageCompletedMark() {
  const gridDictionary = useTranslation('grid')
  return (
    <span
      title={gridDictionary.t('stageCompleted')}
      className="inline-flex shrink-0 text-green-600"
    >
      <Check className="size-3.5" />
    </span>
  )
}
