import { Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { HintTooltip } from '@/components/ui/tooltip'

type InfoTooltipPropsT = {
  content: string
  // Spoken to screen readers in place of the icon — describe what the tooltip explains.
  label?: string
  // Position the trigger relative to its sibling (e.g. 'ml-1').
  className?: string
}

// The (i)-icon flavor of HintTooltip: an icon that reveals `content` on hover/focus.
export function InfoTooltip({
  content,
  label = 'Więcej informacji',
  className,
}: InfoTooltipPropsT) {
  return (
    <HintTooltip content={content} className={cn('align-middle', className)}>
      <button
        type="button"
        aria-label={label}
        className="text-muted-foreground hover:text-foreground inline-flex"
      >
        <Info className="size-3.5" />
      </button>
    </HintTooltip>
  )
}
