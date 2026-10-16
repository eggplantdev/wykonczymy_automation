'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
