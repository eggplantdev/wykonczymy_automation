import { ENTITY_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import type { EquipmentLocationT } from '@/lib/equipment/types'

const whereItIs = (location: EquipmentLocationT): string | undefined => {
  switch (location.kind) {
    case 'holder':
      return `Teraz ma go ${location.name}.`
    case 'warehouse':
      return `Leży w magazynie „${location.name}".`
    case 'service':
      return `Jest w serwisie: ${location.name}.`
    case 'unknown':
      return undefined
  }
}

// Names where the item is, because trashing it does not bring it back from whoever holds it.
export function describeEquipmentTrash(item: { name: string; location: EquipmentLocationT }) {
  return [
    `Przenieść „${item.name}" do kosza? Możesz go przywrócić z Kosza.`,
    whereItIs(item.location),
    `Po ${ENTITY_TRASH_RETENTION_DAYS} dniach zniknie razem z historią przekazań.`,
  ]
    .filter(Boolean)
    .join(' ')
}
