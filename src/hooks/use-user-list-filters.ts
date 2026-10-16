'use client'

import { usePersistedFlag } from '@/hooks/use-persisted-value'
import type { UserRowT } from '@/types/table-rows'

const SHOWN = ['shown', 'hidden'] as const

// Nothing ticked in a group shows the whole group.
const shown = (self: boolean, sibling: boolean) => self || !sibling

export function useUserListFilters() {
  const [activeWorkers, setActiveWorkers] = usePersistedFlag('users:active-workers', SHOWN, true)
  const [inactiveWorkers, setInactiveWorkers] = usePersistedFlag(
    'users:inactive-workers',
    SHOWN,
    false,
  )
  const [activePayouts, setActivePayouts] = usePersistedFlag('users:active-payouts', SHOWN, true)
  const [completedPayouts, setCompletedPayouts] = usePersistedFlag(
    'users:completed-payouts',
    SHOWN,
    false,
  )

  const toggles = [
    {
      id: 'active-workers',
      label: 'Aktywni',
      groupLabel: 'Pracownicy',
      active: activeWorkers,
      onToggle: () => setActiveWorkers(!activeWorkers),
    },
    {
      id: 'inactive-workers',
      label: 'Nieaktywni',
      groupLabel: 'Pracownicy',
      active: inactiveWorkers,
      onToggle: () => setInactiveWorkers(!inactiveWorkers),
    },
    {
      id: 'active-payouts',
      label: 'Aktywne inwestycje',
      description: 'Kwoty z każdej inwestycji, która nie jest zakończona',
      groupLabel: 'Pozostało do wypłaty',
      active: activePayouts,
      onToggle: () => setActivePayouts(!activePayouts),
    },
    {
      id: 'completed-payouts',
      label: 'Zakończone inwestycje',
      description: 'Kwoty z zakończonych inwestycji — wypłata dopiero po przywróceniu na Aktywna',
      groupLabel: 'Pozostało do wypłaty',
      active: completedPayouts,
      onToggle: () => setCompletedPayouts(!completedPayouts),
    },
  ]

  const clear = () => {
    setActiveWorkers(false)
    setInactiveWorkers(false)
    setActivePayouts(false)
    setCompletedPayouts(false)
  }

  return {
    toggles,
    clear,
    isListed: (row: UserRowT) =>
      row.active ? shown(activeWorkers, inactiveWorkers) : shown(inactiveWorkers, activeWorkers),
    payoutBuckets: {
      active: shown(activePayouts, completedPayouts),
      completed: shown(completedPayouts, activePayouts),
    },
  }
}
