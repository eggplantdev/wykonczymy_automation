import { isLiveStatus } from '@/lib/equipment/equipment-status'
import { locationKey } from '@/lib/equipment/rows'
import type { EquipmentRowT } from '@/lib/equipment/types'

export const WHERE_UNKNOWN = 'unknown'

const WHERE_RETIRED = 'retired-nowhere'

/**
 * What one row answers to in the „gdzie jest" filter.
 *
 * A locationless row answers to „Nie wiadomo gdzie" only while it is LIVE — the same rule the option
 * itself is built on. A sold or stolen item has nobody holding it by definition, so it answers to no
 * option at all rather than padding the one filter whose whole job is finding gaps.
 */
export const whereFilterValue = (row: EquipmentRowT): string =>
  locationKey(row.location) ?? (isLiveStatus(row.status) ? WHERE_UNKNOWN : WHERE_RETIRED)

/**
 * The options for the „gdzie jest" menu, built from the FULL dataset rather than from what is
 * currently on screen — otherwise the last matching row takes its own option down with it and the
 * filter cannot be undone (`work-catalogue-data-table.tsx`).
 *
 * Grouped by kind in one dropdown, people first: that single menu is what replaces a warehouse
 * screen, so the two must be pickable side by side. Every workshop collapses onto one „W serwisie"
 * row — a workshop is free text typed once per repair, so one option per spelling would be a menu
 * nobody could use.
 *
 * „Nie wiadomo gdzie" is offered only when a LIVE item actually lacks a location: for a sold or
 * stolen one the empty cell is the correct answer, not a gap to hunt down.
 */
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
