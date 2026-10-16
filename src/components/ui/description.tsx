import { Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type DescriptionSizeT = 'sm' | 'xs' | '2xs'
type DescriptionToneT = 'muted' | 'error'

type DescriptionPropsT = {
  children: React.ReactNode
  className?: string
  withIcon?: boolean
  size?: DescriptionSizeT
  tone?: DescriptionToneT
  role?: 'alert'
}

// The icon rides the text size: the base layer pins every Lucide glyph to 1rem.
const SIZE: Record<DescriptionSizeT, { text: string; icon: string }> = {
  sm: { text: 'text-sm', icon: 'mt-0.5' },
  xs: { text: 'text-xs', icon: '' },
  '2xs': { text: 'text-2xs', icon: 'size-3 mt-px' },
}

const TONE: Record<DescriptionToneT, { color: string; Icon: typeof Info }> = {
  muted: { color: 'text-muted-foreground', Icon: Info },
  error: { color: 'text-destructive', Icon: TriangleAlert },
}

export function Description({
  children,
  className,
  withIcon = true,
  size = 'sm',
  tone = 'muted',
  role,
}: DescriptionPropsT) {
  const { color, Icon } = TONE[tone]

  return (
    <p
      role={role}
      className={cn('flex items-start gap-1 font-normal', color, SIZE[size].text, className)}
    >
      {withIcon && <Icon className={cn('shrink-0', SIZE[size].icon)} aria-hidden />}
      <span>{children}</span>
    </p>
  )
}
