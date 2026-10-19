import { Badge, type BadgeToneT } from '@/components/ui/badge'
import { EQUIPMENT_STATUS_LABELS, type EquipmentStatusT } from '@/lib/equipment/equipment-status'

const STATUS_TONES: Record<EquipmentStatusT, BadgeToneT> = {
  IN_USE: 'positive',
  RETIRED: 'muted',
  SOLD: 'muted',
  LOST: 'muted',
  STOLEN: 'muted',
}

export function EquipmentStatusBadge({ status }: { status: EquipmentStatusT }) {
  return <Badge tone={STATUS_TONES[status]}>{EQUIPMENT_STATUS_LABELS[status].pl}</Badge>
}
