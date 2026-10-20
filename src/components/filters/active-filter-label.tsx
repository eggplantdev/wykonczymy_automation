import { CheckboxRow } from '@/components/ui/checkbox-row'

type ActiveFilterLabelPropsT = {
  activeOnly: boolean
  onToggle: (value: boolean) => void
  activeLabel?: string
  allLabel?: string
}

export function ActiveFilterLabel({
  activeOnly,
  onToggle,
  activeLabel = 'Aktywne',
  allLabel = 'Wszystkie',
}: ActiveFilterLabelPropsT) {
  return (
    <CheckboxRow
      variant="plain"
      checked={activeOnly}
      onCheckedChange={onToggle}
      className="w-fit font-normal"
    >
      {activeOnly ? activeLabel : allLabel}
    </CheckboxRow>
  )
}
