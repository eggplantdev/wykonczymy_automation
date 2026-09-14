import type { DayT } from '@/lib/utils/days'
import {
  classifyWarranty,
  isMailedBucket,
  isMoreUrgent,
  type WarrantyBucketT,
} from '@/lib/equipment/warranty-thresholds'
import type { EquipmentWarrantyRowT } from '@/lib/equipment/types'

/**
 * The bucket this item earns in today's digest, or `null` for silence. Decides only — the caller
 * stamps the bookkeeping, and only once the mail is out.
 *
 * One axis, unlike the fleet's two: a warranty has a date and nothing else to measure. And no
 * re-nag branch, because the fleet's weekly repeat exists for a deadline you can still catch up on;
 * a lapsed warranty is simply gone, so repeating it would be noise nobody can act on.
 */
export const shouldNotifyWarranty = (
  row: EquipmentWarrantyRowT,
  today: DayT,
): WarrantyBucketT | null => {
  const bucket = classifyWarranty(row.warrantyUntil, today)
  if (bucket === null || !isMailedBucket(bucket)) return null

  return isMoreUrgent(bucket, row.warrantyNotifiedBucket) ? bucket : null
}
