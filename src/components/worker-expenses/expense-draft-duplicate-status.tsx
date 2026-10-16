'use client'

import { Button } from '@/components/ui/button'
import type { ParagonDuplicatesT } from '@/lib/queries/expense-draft-duplicates'

export type DuplicateHintsStateT =
  | { status: 'reading' }
  | { status: 'checking' }
  | { status: 'no-read' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; paragons: ParagonDuplicatesT[] }

const STATUS_MESSAGES = {
  reading: 'Odczytywanie paragonów — duplikaty sprawdzimy po odczycie.',
  checking: 'Sprawdzanie duplikatów…',
  'no-read': 'Bez odczytu paragonów nie da się sprawdzić duplikatów.',
} as const

export function ExpenseDraftDuplicateStatus({ state }: { state: DuplicateHintsStateT }) {
  if (state.status === 'ready') {
    return null
  }
  if (state.status === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-destructive text-sm">Nie udało się sprawdzić duplikatów.</p>
        <Button type="button" variant="outline" size="sm" onClick={state.retry}>
          Sprawdź ponownie
        </Button>
      </div>
    )
  }
  return <p className="text-muted-foreground text-sm">{STATUS_MESSAGES[state.status]}</p>
}
