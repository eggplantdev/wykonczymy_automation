import { formatPLDate } from '@/lib/utils/format-date'
import { cn } from '@/lib/utils/cn'
import { targetLabel } from '@/lib/equipment/rows'
import type { EquipmentLocationT } from '@/lib/equipment/types'

/**
 * Which half of the answer this cell is showing. The listing asks „kto ma" and „gdzie leży" as two
 * separate columns, so each one renders only the locations that belong to it and dashes the rest;
 * `undefined` is the single-cell form the item's own page uses, where there is nothing to split.
 *
 * An item with no location at all counts as `place`: what is missing is where the thing is, and
 * hanging the alarm on the person column would accuse a person who was never named.
 */
type LocationAxisT = 'person' | 'place'

type LocationCellPropsT = {
  location: EquipmentLocationT
  locatedAt: string | null
  /**
   * Whether a missing location is a gap worth flagging. A sold or stolen item has nobody holding it
   * by definition (`isLiveStatus`), so the same empty cell must not read as an alarm there.
   */
  live: boolean
  axis?: LocationAxisT
}

const onAxis = (location: EquipmentLocationT, axis?: LocationAxisT) =>
  axis === undefined || (axis === 'person') === (location.kind === 'holder')

/**
 * A warehouse and a workshop render identically on purpose: both answer „gdzie ta rzecz leży", and
 * giving the workshop its own visual language would suggest a third axis the module does not have.
 */
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
      <span className="text-sm">{targetLabel(location)}</span>
      {locatedAt && (
        <span className="text-muted-foreground text-xs">od {formatPLDate(locatedAt)}</span>
      )}
    </div>
  )
}
