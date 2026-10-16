import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { EQUIPMENT_STATUS_LABELS, type EquipmentStatusT } from '@/lib/equipment/equipment-status'

const STATUS_CLASSNAMES: Record<EquipmentStatusT, string> = {
  IN_USE: BADGE_TONE.positive,
  RETIRED: BADGE_TONE.muted,
  SOLD: BADGE_TONE.muted,
  LOST: BADGE_TONE.muted,
  STOLEN: BADGE_TONE.muted,
}

export function EquipmentStatusBadge({ status }: { status: EquipmentStatusT }) {
  return (
    <span className={cn(BADGE_BASE, STATUS_CLASSNAMES[status])}>
      {EQUIPMENT_STATUS_LABELS[status].pl}
    </span>
  )
}
