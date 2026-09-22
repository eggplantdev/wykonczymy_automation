'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import { cn } from '@/lib/utils/cn'

// The panel itself has no chrome of its own — this button is the ONLY way to open or close it, so
// every bar that can show the panel (the owner's toolbar, the client view's slim header) must mount
// it, or the panel gets stuck in whatever state localStorage remembered.
// `size` is caller-chosen: the owner's toolbar packs it into a dense `sm` row, while the client
// view's header carries only two controls and needs this one to read as the primary way in.
// `disabled` belongs to the client view, whose panel is not mounted at all on an empty kosztorys.
// `hasRows` is required — it picks the localStorage key, and a call site that omitted it would bind
// to a different key than the panel it opens.
export function KosztorysTotalsPanelToggle({
  size = 'sm',
  disabled = false,
  hasRows,
}: {
  size?: 'sm' | 'default' | 'lg'
  disabled?: boolean
  hasRows: boolean
}) {
  const [totalsOpen, setTotalsOpen] = useTotalsPanelOpen(hasRows)

  return (
    <Button
      size={size}
      disabled={disabled}
      title={disabled ? 'Kosztorys jest pusty — nie ma czego podsumować' : undefined}
      variant="ai"
      animations={['comet', 'breathe']}
      onClick={() => setTotalsOpen(!totalsOpen)}
    >
      <ChevronDown
        className={cn('transition-transform duration-200', totalsOpen && 'rotate-180')}
      />
      Podsumowanie
    </Button>
  )
}
