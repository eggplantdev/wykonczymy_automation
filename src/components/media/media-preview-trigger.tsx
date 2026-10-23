import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SELECT_TRIGGER_CLASS } from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'

export type MediaPreviewTriggerPropsT = {
  label: string
  ariaLabel: string
  onClick: () => void
  variant?: 'field' | 'compact' | 'chip'
  className?: string
}

export function MediaPreviewTrigger({
  label,
  ariaLabel,
  onClick,
  variant = 'field',
  className,
}: MediaPreviewTriggerPropsT) {
  if (variant === 'field') {
    return (
      // eslint-disable-next-line local/no-hand-rolled-ui -- styled as a select field, not a Button
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        data-size="default"
        className={cn(
          SELECT_TRIGGER_CLASS,
          'text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/50 min-w-0 cursor-pointer justify-start',
          className,
        )}
      >
        <FileText />
        <span className="truncate">{label}</span>
      </button>
    )
  }

  const isCompact = variant === 'compact'

  return (
    <Button
      type="button"
      variant={isCompact ? 'ghost' : 'outline'}
      size={isCompact ? 'icon' : 'xs'}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'text-muted-foreground hover:text-foreground',
        isCompact && 'mx-auto',
        className,
      )}
    >
      <FileText />
      {!isCompact && <span className="truncate">{label}</span>}
    </Button>
  )
}
