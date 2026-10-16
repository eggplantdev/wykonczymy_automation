import { formatPLDate } from '@/lib/utils/format-date'
import { cn } from '@/lib/utils/cn'
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
  if (!onAxis(location, axis)) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  if (location.kind === 'unknown') {
    return (
      <span className={cn('text-xs', live ? 'text-destructive' : 'text-muted-foreground')}>
        {live ? 'Nie wiadomo gdzie' : '—'}
      </span>
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
