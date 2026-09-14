import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { VEHICLE_STATUS_LABELS, type VehicleStatusT } from '@/lib/fleet/vehicle-status'

const STATUS_CLASSNAMES: Record<VehicleStatusT, string> = {
  ACTIVE: BADGE_TONE.positive,
  RETIRED: BADGE_TONE.muted,
}

export function VehicleStatusBadge({ status }: { status: VehicleStatusT }) {
  return (
    <span className={cn(BADGE_BASE, STATUS_CLASSNAMES[status])}>
      {VEHICLE_STATUS_LABELS[status].pl}
    </span>
  )
}
