'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'
import { cn } from '@/lib/utils/cn'

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

  const button = (
    <Button
      size={size}
      disabled={disabled}
      aria-expanded={totalsOpen}
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

  if (!disabled) return button

  // A disabled button gets no pointer events, so the tooltip hangs on a wrapper.
  return (
    <SimpleTooltip content="Kosztorys jest pusty — nie ma czego podsumować">
      <span tabIndex={0} className="inline-flex">
        {button}
      </span>
    </SimpleTooltip>
  )
}
