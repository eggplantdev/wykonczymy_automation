import { AlertBadge } from '@/components/fleet/alert-badge'
import { INSPECTION_TYPE_LABELS, type PerformedInspectionTypeT } from '@/lib/fleet/inspection-types'

const FLAG_BADGE_LABELS: Record<PerformedInspectionTypeT, string> = {
  TECHNICAL: 'Przegląd',
  INSURANCE: 'OC',
  OIL_CHANGE: 'Olej',
  WARRANTY: 'Gwarancja',
  TYRES: 'Opony',
  SERVICE: 'Serwis',
}

export function FlagBadge({
  type,
  className,
}: {
  type: PerformedInspectionTypeT
  className?: string
}) {
  return (
    <AlertBadge title={`Do wymiany: ${INSPECTION_TYPE_LABELS[type].pl}`} className={className}>
      {FLAG_BADGE_LABELS[type]}
    </AlertBadge>
  )
}
