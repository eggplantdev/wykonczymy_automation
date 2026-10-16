import type { Payload } from 'payload'
import { assertCompletePage } from '@/lib/queries/assert-complete-page'
import { stampSequentially } from '@/lib/db/stamp-sequentially'
import type { StampT } from '@/lib/equipment/digest'
import type { EquipmentWarrantyRowT } from '@/lib/equipment/types'

/**
 * `assertCompletePage` fails the whole digest closed on a second page, so the narrower the query,
 * the further away that ceiling is.
 */
export async function loadWarrantyRows(payload: Payload): Promise<EquipmentWarrantyRowT[]> {
  const page = await payload.find({
    collection: 'equipment',
    where: {
      status: { equals: 'IN_USE' },
      warrantyUntil: { exists: true },
      trashedAt: { exists: false },
    },
    sort: 'name',
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })

  return assertCompletePage(page, 'loadWarrantyRows').map((item) => ({
    id: item.id,
    name: item.name,
    make: item.make ?? '',
    model: item.model ?? '',
    serialNumber: item.serialNumber ?? '',
    status: item.status,
    warrantyUntil: item.warrantyUntil ?? null,
    warrantyNotifiedBucket: item.warrantyNotifiedBucket ?? null,
  }))
}

/**
 * A stamp written ahead of the mail would silence a warranty for good on a delivery that never
 * happened.
 */
export async function stampNotified(
  payload: Payload,
  stamps: readonly StampT[],
  sentAt: Date = new Date(),
): Promise<number[]> {
  const at = sentAt.toISOString()

  return stampSequentially(
    payload,
    'equipment',
    stamps.map((stamp) => ({
      id: stamp.equipmentId,
      data: { warrantyNotifiedBucket: stamp.bucket, warrantyNotifiedAt: at },
    })),
    { skipRevalidation: true },
  )
}
