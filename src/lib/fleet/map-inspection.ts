import type { InspectionRecordT } from '@/lib/fleet/types'
import type { VehicleInspection } from '@/payload-types'

const asId = (value: number | { id: number }): number =>
  typeof value === 'number' ? value : value.id

export const toInspectionEvent = (row: VehicleInspection): InspectionRecordT => ({
  id: row.id,
  vehicleId: asId(row.vehicle),
  type: row.type,
  performedAt: row.performedAt,
  nextDueAt: row.nextDueAt ?? null,
  odometer: row.odometer ?? null,
  notifiedThreshold: row.notifiedThreshold ?? null,
  notifiedAt: row.notifiedAt ?? null,
  odometerNotifiedAt: row.odometerNotifiedAt ?? null,
  cost: row.cost ?? null,
  insurer: row.insurer ?? '',
  policyNumber: row.policyNumber ?? '',
  note: row.note ?? '',
  attachmentCount: row.attachments?.length ?? 0,
})
