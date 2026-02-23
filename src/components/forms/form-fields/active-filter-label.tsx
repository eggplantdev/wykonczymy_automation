import { Checkbox } from '@/components/ui/checkbox'

type ActiveFilterLabelPropsT = {
  readonly activeOnly: boolean
  readonly onToggle: (value: boolean) => void
}

export function ActiveFilterLabel({ activeOnly, onToggle }: ActiveFilterLabelPropsT) {
  return (
    <label className="flex w-fit items-center gap-2 text-sm font-normal">
      <Checkbox checked={activeOnly} onCheckedChange={(v: boolean) => onToggle(v === true)} />
      {activeOnly ? 'Aktywne' : 'Wszystkie'}
    </label>
  )
}
