import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { COLOR_TOKEN_CLASSES, type ColorTokenT } from '@/styles/color-tokens'

type DotBadgePropsT = Omit<React.ComponentProps<'span'>, 'color'> & {
  color: ColorTokenT
}

export function DotBadge({ color, className, children, ...props }: DotBadgePropsT) {
  const { border, dot } = COLOR_TOKEN_CLASSES[color]
  return (
    <Badge
      tone="muted"
      appearance="outline"
      className={cn('min-w-0 gap-1.5', border, className)}
      {...props}
    >
      <span className={cn('size-2 shrink-0 rounded-full', dot)} />
      <span className="truncate">{children}</span>
    </Badge>
  )
}
