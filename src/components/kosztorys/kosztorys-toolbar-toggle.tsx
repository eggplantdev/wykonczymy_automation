'use client'

import { SimpleTooltip } from '@/components/ui/tooltip'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'

type PropsT<T extends string> = {
  legend: string
  options: OptionT<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label': string
}

export function KosztorysToolbarToggle<T extends string>({
  legend,
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
}: PropsT<T>) {
  return (
    <SimpleTooltip content={legend} delayDuration={500} className="max-w-xs whitespace-pre-line">
      {/* SimpleTooltip's trigger is `asChild`, so Radix clones this child and hands it a ref —
          it needs a DOM node. ToggleGroup is a plain function component that never forwards one,
          hence the span. `inline-flex` keeps it from disturbing the toolbar's layout. */}
      <span className="inline-flex">
        <ToggleGroup options={options} value={value} onChange={onChange} aria-label={ariaLabel} />
      </span>
    </SimpleTooltip>
  )
}
