import { isLiveStatus } from '@/lib/equipment/equipment-status'
import { locationKey } from '@/lib/equipment/rows'
import type { EquipmentRowT } from '@/lib/equipment/types'

export const WHERE_UNKNOWN = 'unknown'

const WHERE_RETIRED = 'retired-nowhere'

export const whereFilterValue = (row: EquipmentRowT): string =>
  locationKey(row.location) ?? (isLiveStatus(row.status) ? WHERE_UNKNOWN : WHERE_RETIRED)

export const whereFilterOptions = (rows: readonly EquipmentRowT[]) => {
  const people = new Map<string, string>()
  const warehouses = new Map<string, string>()
  let hasService = false
  let hasUnknown = false

  for (const row of rows) {
    switch (row.location.kind) {
      case 'holder':
        people.set(`holder:${row.location.id}`, row.location.name)
        break
      case 'warehouse':
        warehouses.set(`warehouse:${row.location.id}`, row.location.name)
        break
      case 'service':
        hasService = true
        break
      case 'unknown':
        hasUnknown ||= isLiveStatus(row.status)
        break
    }
  }

  const byLabel = ([, a]: [string, string], [, b]: [string, string]) => a.localeCompare(b, 'pl')
  const toOptions = (entries: Map<string, string>) =>
    [...entries.entries()].sort(byLabel).map(([value, label]) => ({ value, label }))

  return [
    ...toOptions(people),
    ...toOptions(warehouses),
    ...(hasService ? [{ value: 'service', label: 'W serwisie' }] : []),
    ...(hasUnknown ? [{ value: WHERE_UNKNOWN, label: 'Nie wiadomo gdzie' }] : []),
  ]
}
