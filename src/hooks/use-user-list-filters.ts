'use client'

import type { FilterTogglesBulkT } from '@/components/filters/filter-multi-select'
import { usePersistedFlag } from '@/hooks/use-persisted-value'
import type { UserRowT } from '@/types/table-rows'

const SHOWN = ['shown', 'hidden'] as const

/** The employee list's „Filtry" menu: which workers are listed, and which investments their
 *  „Pozostało do wypłaty" is summed over. */
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

  const togglesBulk: FilterTogglesBulkT = {
    allActive: toggles.every((toggle) => toggle.active),
    onToggleAll: (next) => {
      setActiveWorkers(next)
      setInactiveWorkers(next)
      setActivePayouts(next)
      setCompletedPayouts(next)
    },
  }

  return {
    toggles,
    togglesBulk,
    isListed: (row: UserRowT) => (row.active ? activeWorkers : inactiveWorkers),
    payoutBuckets: { active: activePayouts, completed: completedPayouts },
  }
}
