import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const SOFT_TONES = {
  positive: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  negative: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  muted: 'bg-muted text-muted-foreground',
  destructive: 'bg-destructive/10 text-destructive',
  red: 'bg-chart-red/10 text-chart-red',
  sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  cyan: 'bg-neon-cyan/15 text-cyan-700 dark:text-neon-cyan',
  primary: 'bg-primary/10 text-primary',
  section: 'bg-section-pill text-section-pill-ink',
} as const

export type BadgeToneT = keyof typeof SOFT_TONES

export const BADGE_OUTLINE_TONES: Record<BadgeToneT, string> = {
  positive: 'border-teal-500 text-teal-600 dark:border-teal-600 dark:text-teal-300',
  pending: 'border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300',
  negative: 'border-red-400 text-red-700 dark:border-red-700 dark:text-red-300',
  muted: 'border-border',
  destructive: 'border-destructive text-destructive',
  red: 'border-chart-red text-chart-red',
  sky: 'border-sky-400 text-sky-700 dark:border-sky-700 dark:text-sky-300',
  violet: 'border-violet-400 text-violet-700 dark:border-violet-700 dark:text-violet-300',
  orange: 'border-orange-400 text-orange-700 dark:border-orange-700 dark:text-orange-300',
  cyan: 'border-neon-cyan text-cyan-700 dark:text-neon-cyan',
  primary: 'border-primary text-primary',
  section: 'border-section-pill-ink text-section-pill-ink',
}

const BADGE_SOLID_TONES: Record<BadgeToneT, string> = {
  positive: 'bg-teal-600 text-white',
  pending: 'bg-amber-500 text-black',
  negative: 'bg-red-600 text-white',
  muted: 'bg-muted-foreground text-background',
  destructive: 'bg-destructive text-white',
  red: 'bg-chart-red text-white',
  sky: 'bg-sky-600 text-white',
  violet: 'bg-violet-600 text-white',
  orange: 'bg-orange-600 text-white',
  cyan: 'bg-neon-cyan text-black',
  primary: 'bg-primary text-primary-foreground',
  section: 'bg-section-pill-ink text-section-pill',
}

type BadgeAppearanceT = 'soft' | 'outline' | 'solid'

type BadgeShapeT = 'rounded' | 'pill'

type BadgeVariantsT = { tone: BadgeToneT; appearance?: BadgeAppearanceT; shape?: BadgeShapeT }

const APPEARANCE_CLASSES = {
  soft: SOFT_TONES,
  outline: BADGE_OUTLINE_TONES,
  solid: BADGE_SOLID_TONES,
} satisfies Record<BadgeAppearanceT, Record<BadgeToneT, string>>

function badgeVariants({ tone, appearance = 'soft', shape = 'rounded' }: BadgeVariantsT) {
  return cn(
    'inline-flex items-center whitespace-nowrap px-1.5 py-0.5 text-xs font-medium',
    shape === 'pill' ? 'rounded-full' : 'rounded-md',
    appearance === 'outline' && 'border',
    APPEARANCE_CLASSES[appearance][tone],
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
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring/50 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors focus-visible:ring-3 focus-visible:outline-none"
        >
          <X className="size-3.5" />
        </button>
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
