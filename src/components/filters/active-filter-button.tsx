'use client'

import { Check } from 'lucide-react'
import {
  FilterTriggerButton,
  GRID_FILTER_TRIGGER_CLASS,
} from '@/components/filters/filter-trigger-button'

type ActiveFilterButtonPropsT = {
  isActive: boolean
  onChange: (value: boolean) => void
  activeLabel: string
  /** Only where the two states name different SETS („Aktywne" / „Wszystkie"). Omit it where the
   *  button names one action instead — the variant and the tick already say whether it is on. */
  allLabel?: string
}

export function ActiveFilterButton({
  isActive,
  onChange,
  activeLabel,
  allLabel = activeLabel,
}: ActiveFilterButtonPropsT) {
  return (
    <FilterTriggerButton
      active={isActive}
      icon={isActive ? Check : undefined}
      onClick={() => onChange(!isActive)}
      className={GRID_FILTER_TRIGGER_CLASS}
    >
      {isActive ? activeLabel : allLabel}
    </FilterTriggerButton>
  )
}
