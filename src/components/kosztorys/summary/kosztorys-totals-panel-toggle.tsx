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
// `disabled` on an empty kosztorys, where the body mounts no panel at all: without it the button
// would flip to „Schowaj podsumowanie" over a screen where nothing opened.
export function KosztorysTotalsPanelToggle({
  size = 'sm',
  disabled = false,
}: {
  size?: 'sm' | 'default' | 'lg'
  disabled?: boolean
}) {
  const [totalsOpen, setTotalsOpen] = useTotalsPanelOpen()

  return (
    <Button
      size={size}
      disabled={disabled}
      title={disabled ? 'Kosztorys jest pusty — nie ma czego podsumować' : undefined}
      variant="ai"
      onClick={() => setTotalsOpen(!totalsOpen)}
    >
      {/* Both labels stacked in the same grid cell so the button sizes to the wider of the two —
          a plain ternary let the width twitch by a couple px on toggle (kerning, not length). */}
      <span className="grid">
        <span className={cn('col-start-1 row-start-1', totalsOpen && 'invisible')}>
          Pokaż podsumowanie
        </span>
        <span className={cn('col-start-1 row-start-1', !totalsOpen && 'invisible')}>
          Schowaj podsumowanie
        </span>
      </span>
      <ChevronDown
        className={cn('transition-transform duration-200', totalsOpen && 'rotate-180')}
      />
    </Button>
  )
}
