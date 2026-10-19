import { Badge, type BadgeToneT } from '@/components/ui/badge'
import { VEHICLE_STATUS_LABELS, type VehicleStatusT } from '@/lib/fleet/vehicle-status'

const STATUS_TONES: Record<VehicleStatusT, BadgeToneT> = {
  ACTIVE: 'positive',
  RETIRED: 'muted',
}

export function VehicleStatusBadge({ status }: { status: VehicleStatusT }) {
  return <Badge tone={STATUS_TONES[status]}>{VEHICLE_STATUS_LABELS[status].pl}</Badge>
}
