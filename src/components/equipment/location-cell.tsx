import { EmptyValue } from '@/components/ui/empty-value'
import { formatPLDate } from '@/lib/utils/format-date'
import { targetLabel } from '@/lib/equipment/rows'
import type { EquipmentLocationT } from '@/lib/equipment/types'

type LocationAxisT = 'person' | 'place'

type LocationCellPropsT = {
  location: EquipmentLocationT
  locatedAt: string | null
  live: boolean
  axis?: LocationAxisT
}

const onAxis = (location: EquipmentLocationT, axis?: LocationAxisT) =>
  axis === undefined || (axis === 'person') === (location.kind === 'holder')

export function LocationCell({ location, locatedAt, live, axis }: LocationCellPropsT) {
  if (!onAxis(location, axis) || (location.kind === 'unknown' && !live)) {
    return <EmptyValue size="xs" />
  }

  if (location.kind === 'unknown') {
    return (
      // eslint-disable-next-line local/no-hand-rolled-ui -- table-cell status colour, not an error message
      <span className="text-destructive text-xs">Nie wiadomo gdzie</span>
    )
  }

  return (
    <div className="flex flex-col leading-tight">
      <span>{targetLabel(location)}</span>
      {locatedAt && (
        <span className="text-muted-foreground text-xs">od {formatPLDate(locatedAt)}</span>
      )}
    </div>
  )
}
