import { Info } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SimpleTooltip } from '@/components/ui/tooltip'

type InfoTooltipPropsT = {
  content: string
  // Spoken to screen readers in place of the icon — describe what the tooltip explains.
  label?: string
  // Position the trigger relative to its sibling (e.g. 'ml-1').
  className?: string
}

// An (i) icon that reveals `content` on hover/focus. Width-capped and honours
// newlines in `content` so multi-line explanations format predictably.
export function InfoTooltip({
  content,
  label = 'Więcej informacji',
  className,
}: InfoTooltipPropsT) {
  return (
    <SimpleTooltip content={content} className="max-w-xs whitespace-pre-line">
      <button
        type="button"
        aria-label={label}
        className={cn(
          'text-muted-foreground hover:text-foreground inline-flex align-middle',
          className,
        )}
      >
        <Info className="size-3.5" />
      </button>
    </SimpleTooltip>
  )
}
