import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

export const BADGE_TONES = {
  positive: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  negative: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  muted: 'bg-muted text-muted-foreground',
  destructive: 'bg-destructive/10 text-destructive',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  cyan: 'bg-neon-cyan/15 text-cyan-700 dark:text-neon-cyan',
  section: 'bg-section-pill text-section-pill-ink',
} as const

export type BadgeToneT = keyof typeof BADGE_TONES

const APPEARANCE_CLASSES = {
  outline: 'border border-border',
  solid: 'bg-primary text-primary-foreground',
}

type BadgeShapeT = 'rounded' | 'pill'

type BadgeVariantsT = { shape?: BadgeShapeT } & (
  | { tone: BadgeToneT; appearance?: 'soft' }
  | { tone?: never; appearance: keyof typeof APPEARANCE_CLASSES }
)

function badgeVariants({
  tone,
  appearance = 'soft',
  shape = 'rounded',
}: {
  tone?: BadgeToneT
  appearance?: BadgeVariantsT['appearance']
  shape?: BadgeShapeT
}) {
  return cn(
    'inline-flex items-center whitespace-nowrap px-1.5 py-0.5 text-xs font-medium',
    shape === 'pill' ? 'rounded-full' : 'rounded-md',
    appearance === 'soft' ? tone && BADGE_TONES[tone] : APPEARANCE_CLASSES[appearance],
  )
}

type BadgePropsT = React.ComponentProps<'span'> &
  BadgeVariantsT & {
    onRemove?: () => void
    removeLabel?: string
  }

export function Badge({
  tone,
  appearance,
  shape,
  onRemove,
  removeLabel,
  className,
  children,
  ...props
}: BadgePropsT) {
  return (
    <span
      className={cn(
        badgeVariants({ tone, appearance, shape }),
        onRemove && 'gap-1 pr-0.5 pl-2.5',
        className,
      )}
      {...props}
    >
      {children}
      {onRemove && (
        <Button
          type="button"
          variant="ghostDestructive"
          size="inline"
          onClick={onRemove}
          aria-label={removeLabel}
          className="rounded-full p-0.5"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </span>
  )
}

type BadgeButtonPropsT = React.ComponentProps<'button'> & BadgeVariantsT

export function BadgeButton({ tone, appearance, shape, className, ...props }: BadgeButtonPropsT) {
  return (
    <button
      type="button"
      className={cn(
        badgeVariants({ tone, appearance, shape }),
        'focus-visible:ring-ring/50 cursor-pointer outline-none hover:opacity-70 focus-visible:ring-3',
        className,
      )}
      {...props}
    />
  )
}
