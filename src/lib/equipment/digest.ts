import { daysBetween, toWarsawDay, type DayT } from '@/lib/utils/days'
import { shouldNotifyWarranty } from '@/lib/equipment/should-notify'
import type { EquipmentWarrantyRowT } from '@/lib/equipment/types'

export type WarrantyEntryT = {
  equipmentId: number
  name: string
  make: string
  model: string
  serialNumber: string
  warrantyUntil: DayT
  daysLeft: number
}

/** What to write back once the mail is out — one bucket per item, no second axis to split. */
export type StampT = {
  equipmentId: number
  bucket: number
}

export type EquipmentDigestT = {
  within7: WarrantyEntryT[]
  within30: WarrantyEntryT[]
  stamps: StampT[]
}

export const isEmptyDigest = (digest: EquipmentDigestT): boolean =>
  digest.within7.length === 0 && digest.within30.length === 0

/**
 * Today's digest, decided purely from the loaded rows — no clock, no DB, no send. `today` is an
 * argument so the boundaries can be asserted without pretending it is a particular date.
 *
 * Only `IN_USE` items enter: the warranty of something sold, written off or lost is history rather
 * than a task, and mailing about it would ask the reader to act on a thing the firm no longer has.
 */
export const buildEquipmentDigest = (
  rows: readonly EquipmentWarrantyRowT[],
  today: DayT,
): EquipmentDigestT => {
  const digest: EquipmentDigestT = { within7: [], within30: [], stamps: [] }

  for (const row of rows) {
    if (row.status !== 'IN_USE') continue

    const bucket = shouldNotifyWarranty(row, today)
    // `bucket` is non-null only for a mailed bucket, which is only ever reached with a date.
    if (bucket === null || !row.warrantyUntil) continue

    const until = toWarsawDay(row.warrantyUntil)
    const entry: WarrantyEntryT = {
      equipmentId: row.id,
      name: row.name,
      make: row.make,
      model: row.model,
      serialNumber: row.serialNumber,
      warrantyUntil: until,
      daysLeft: daysBetween(today, until),
    }

    if (bucket === 7) digest.within7.push(entry)
    else digest.within30.push(entry)

    digest.stamps.push({ equipmentId: row.id, bucket })
  }

  return digest
}
