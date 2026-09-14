import type { Payload } from 'payload'
import { groupByVehicle, loadFleetDataset } from '@/lib/fleet/dataset'
import { stampSequentially } from '@/lib/db/stamp-sequentially'
import type { VehicleHistoryT } from '@/lib/fleet/types'
import type { StampT } from '@/lib/fleet/reminder-sweep'

export const loadFleetHistories = async (payload: Payload): Promise<VehicleHistoryT[]> =>
  groupByVehicle(await loadFleetDataset(payload))

/**
 * Record what was announced — called only after a successful send. A stamp written ahead of the mail
 * would silence the deadline for a week on a delivery that never happened.
 */
export async function stampNotified(
  payload: Payload,
  stamps: readonly StampT[],
  sentAt: Date = new Date(),
): Promise<number[]> {
  const at = sentAt.toISOString()

  return stampSequentially(
    payload,
    'vehicle-inspections',
    stamps.map((stamp) => ({
      id: stamp.inspectionId,
      data: {
        ...(stamp.threshold !== null && { notifiedThreshold: stamp.threshold, notifiedAt: at }),
        ...(stamp.odometer && { odometerNotifiedAt: at }),
      },
    })),
  )
}
