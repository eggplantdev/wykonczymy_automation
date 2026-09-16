import { X } from 'lucide-react'
import { FilterTriggerButton } from '@/components/filters/filter-trigger-button'

type ClearButtonPropsT = {
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}

export function ClearButton({ onClick, disabled, children }: ClearButtonPropsT) {
  return (
    <FilterTriggerButton active={false} icon={X} onClick={onClick} disabled={disabled}>
      {children}
    </FilterTriggerButton>
  )
}
