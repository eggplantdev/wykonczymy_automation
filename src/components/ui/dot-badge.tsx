import { Badge } from '@/components/ui/badge'
import { BADGE_BORDER_CLASS } from '@/components/ui/badge-border'
import { cn } from '@/lib/utils/cn'
import { COLOR_TOKEN_CLASSES, type ColorTokenT } from '@/styles/color-tokens'

type DotBadgePropsT = Omit<React.ComponentProps<'span'>, 'color'> & {
  color: ColorTokenT
}

export function DotBadge({ color, className, children, ...props }: DotBadgePropsT) {
  return (
    <Badge
      tone="muted"
      appearance="outline"
      className={cn('min-w-0 gap-1.5', BADGE_BORDER_CLASS[color], className)}
      {...props}
    >
      <span className={cn('size-2 shrink-0 rounded-full', COLOR_TOKEN_CLASSES[color].dot)} />
      <span className="truncate">{children}</span>
    </Badge>
  )
}
