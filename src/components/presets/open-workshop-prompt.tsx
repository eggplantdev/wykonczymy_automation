'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useOpenPreset } from '@/hooks/use-open-preset'

// The warsztat holds a different szablon than this url names — a stale tab, a hand-typed url, or
// someone else having opened theirs in the meantime.
export function OpenWorkshopPrompt({ presetId, name }: { presetId: number; name: string }) {
  const { open, pendingId } = useOpenPreset()
  const pending = pendingId === presetId

  return (
    <EmptyState
      title={`Szablon „${name}" nie jest teraz otwarty`}
      description="W warsztacie leży inny szablon. Otwórz go ponownie, żeby zobaczyć i zmienić jego treść."
    >
      <div className="flex gap-2">
        <Button onClick={() => open(presetId)} disabled={pending}>
          {pending ? 'Otwieram…' : 'Otwórz szablon'}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/szablony">Wróć do listy</Link>
        </Button>
      </div>
    </EmptyState>
  )
}
