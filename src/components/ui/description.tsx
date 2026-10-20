import { Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type DescriptionSizeT = 'sm' | 'xs' | '2xs'
export type DescriptionToneT = 'muted' | 'error' | 'warning'

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

export const DESCRIPTION_TONE_CLASS: Record<DescriptionToneT, string> = {
  muted: 'text-muted-foreground',
  error: 'text-destructive',
  warning: 'text-warning',
}

const TONE_ICON: Record<DescriptionToneT, typeof Info> = {
  muted: Info,
  error: TriangleAlert,
  warning: TriangleAlert,
}

export function Description({
  children,
  className,
  size = 'sm',
  tone = 'muted',
  withIcon = tone !== 'error',
  role,
}: DescriptionPropsT) {
  const Icon = TONE_ICON[tone]

  return (
    <p
      role={role}
      className={cn('flex items-start gap-1 font-normal', DESCRIPTION_TONE_CLASS[tone], SIZE[size].text, className)}
    >
      {withIcon && <Icon className={cn('shrink-0', SIZE[size].icon)} aria-hidden />}
      <span>{children}</span>
    </p>
  )
}
