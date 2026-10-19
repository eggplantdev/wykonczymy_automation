import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

const DOT_BADGE_COLORS = {
  'muted-foreground': { border: 'border-muted-foreground', dot: 'bg-muted-foreground' },
  'section-blue-soft': { border: 'border-section-blue-soft', dot: 'bg-section-blue-soft' },
  'section-blue': { border: 'border-section-blue', dot: 'bg-section-blue' },
  'section-blue-deep': { border: 'border-section-blue-deep', dot: 'bg-section-blue-deep' },
  'section-turquoise-soft': {
    border: 'border-section-turquoise-soft',
    dot: 'bg-section-turquoise-soft',
  },
  'section-turquoise': { border: 'border-section-turquoise', dot: 'bg-section-turquoise' },
  'section-turquoise-deep': {
    border: 'border-section-turquoise-deep',
    dot: 'bg-section-turquoise-deep',
  },
  'section-teal-soft': { border: 'border-section-teal-soft', dot: 'bg-section-teal-soft' },
  'section-teal': { border: 'border-section-teal', dot: 'bg-section-teal' },
  'section-teal-deep': { border: 'border-section-teal-deep', dot: 'bg-section-teal-deep' },
  'section-green-soft': { border: 'border-section-green-soft', dot: 'bg-section-green-soft' },
  'section-green': { border: 'border-section-green', dot: 'bg-section-green' },
  'section-green-deep': { border: 'border-section-green-deep', dot: 'bg-section-green-deep' },
  'section-yellow-soft': { border: 'border-section-yellow-soft', dot: 'bg-section-yellow-soft' },
  'section-yellow': { border: 'border-section-yellow', dot: 'bg-section-yellow' },
  'section-yellow-deep': { border: 'border-section-yellow-deep', dot: 'bg-section-yellow-deep' },
  'section-orange-soft': { border: 'border-section-orange-soft', dot: 'bg-section-orange-soft' },
  'section-orange': { border: 'border-section-orange', dot: 'bg-section-orange' },
  'section-orange-deep': { border: 'border-section-orange-deep', dot: 'bg-section-orange-deep' },
  'section-red-soft': { border: 'border-section-red-soft', dot: 'bg-section-red-soft' },
  'section-red': { border: 'border-section-red', dot: 'bg-section-red' },
  'section-red-deep': { border: 'border-section-red-deep', dot: 'bg-section-red-deep' },
  'section-pink-soft': { border: 'border-section-pink-soft', dot: 'bg-section-pink-soft' },
  'section-pink': { border: 'border-section-pink', dot: 'bg-section-pink' },
  'section-pink-deep': { border: 'border-section-pink-deep', dot: 'bg-section-pink-deep' },
  'section-purple-soft': { border: 'border-section-purple-soft', dot: 'bg-section-purple-soft' },
  'section-purple': { border: 'border-section-purple', dot: 'bg-section-purple' },
  'section-purple-deep': { border: 'border-section-purple-deep', dot: 'bg-section-purple-deep' },
  'transfer-red-warm': { border: 'border-transfer-red-warm', dot: 'bg-transfer-red-warm' },
  'transfer-red-dark': { border: 'border-transfer-red-dark', dot: 'bg-transfer-red-dark' },
  'transfer-fuchsia': { border: 'border-transfer-fuchsia', dot: 'bg-transfer-fuchsia' },
} as const

export type DotBadgeColorT = keyof typeof DOT_BADGE_COLORS

export const DOT_BADGE_COLOR_KEYS = Object.keys(DOT_BADGE_COLORS) as DotBadgeColorT[]

type DotBadgePropsT = Omit<React.ComponentProps<'span'>, 'color'> & {
  color: DotBadgeColorT
}

export function DotBadge({ color, className, children, ...props }: DotBadgePropsT) {
  const { border, dot } = DOT_BADGE_COLORS[color]
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
