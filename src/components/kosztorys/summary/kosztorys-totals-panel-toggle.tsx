'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import * as Collapsible from '@/components/ui/collapsible'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { useTotalsPanelOpen } from '@/components/kosztorys/summary/hooks/use-totals-panel-open'

export function KosztorysTotalsPanelToggle({
  size = 'sm',
  disabled = false,
  hasRows,
  className,
}: {
  size?: 'sm' | 'default' | 'lg'
  disabled?: boolean
  hasRows: boolean
  className?: string
}) {
  const [totalsOpen, setTotalsOpen] = useTotalsPanelOpen(hasRows)

  const button = (
    <Button
      size={size}
      disabled={disabled}
      className={disabled ? 'w-full' : className}
      aria-expanded={totalsOpen}
      variant="ai"
      animations={['comet', 'breathe']}
      onClick={() => setTotalsOpen(!totalsOpen)}
    >
      <Collapsible.Chevron open={totalsOpen} />
      Podsumowanie
    </Button>
  )

  if (!disabled) return button

  // A disabled button gets no pointer events, so the tooltip hangs on a wrapper.
  return (
    <SimpleTooltip content="Kosztorys jest pusty — nie ma czego podsumować">
      <span tabIndex={0} className={cn('inline-flex', className)}>
        {button}
      </span>
    </SimpleTooltip>
  )
}
