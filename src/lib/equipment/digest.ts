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

export const buildEquipmentDigest = (
  rows: readonly EquipmentWarrantyRowT[],
  today: DayT,
): EquipmentDigestT => {
  const digest: EquipmentDigestT = { within7: [], within30: [], stamps: [] }

  for (const row of rows) {
    if (row.status !== 'IN_USE') continue

    const bucket = shouldNotifyWarranty(row, today)
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
