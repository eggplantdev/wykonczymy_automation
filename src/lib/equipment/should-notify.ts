import type { DayT } from '@/lib/utils/days'
import {
  classifyWarranty,
  isMailedBucket,
  isMoreUrgent,
  type WarrantyBucketT,
} from '@/lib/equipment/warranty-thresholds'
import type { EquipmentWarrantyRowT } from '@/lib/equipment/types'

export const shouldNotifyWarranty = (
  row: EquipmentWarrantyRowT,
  today: DayT,
): WarrantyBucketT | null => {
  const bucket = classifyWarranty(row.warrantyUntil, today)
  if (bucket === null || !isMailedBucket(bucket)) return null

  return isMoreUrgent(bucket, row.warrantyNotifiedBucket) ? bucket : null
}
