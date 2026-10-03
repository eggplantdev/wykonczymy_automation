import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import type { VehicleStatusT } from '@/lib/fleet/vehicle-status'

// Warns and never refuses: every car in use has inspections, so a blocker would make the trash
// unreachable for exactly the car entered by mistake.
export function describeVehicleTrash(vehicle: {
  registration: string
  status: VehicleStatusT
  inspectionCount: number
}): string {
  return [
    `Przenieść „${vehicle.registration}" do kosza? Możesz go przywrócić z Kosza.`,
    vehicle.status === 'ACTIVE' && 'Przypomnienia o przeglądach przestaną przychodzić.',
    vehicle.inspectionCount > 0 &&
      `Po ${ENTITY_TRASH_RETENTION_DAYS} dniach zniknie razem z historią przeglądów (${vehicle.inspectionCount}).`,
  ]
    .filter(Boolean)
    .join(' ')
}
