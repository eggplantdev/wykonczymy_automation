import { Checkbox } from '@/components/ui/checkbox'

type ActiveFilterLabelPropsT = {
  activeOnly: boolean
  onToggle: (value: boolean) => void
  // Polish agreement: the default is neuter/non-personal („aktywne inwestycje", „aktywne kasy"), so a
  // list of people has to override it — „aktywni pracownicy".
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
    <label className="flex w-fit items-center gap-2 text-sm font-normal">
      <Checkbox checked={activeOnly} onCheckedChange={(v: boolean) => onToggle(v === true)} />
      {activeOnly ? activeLabel : allLabel}
    </label>
  )
}
