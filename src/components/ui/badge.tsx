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
}

type BadgeAppearanceT = 'soft' | 'outline'

type BadgeVariantsT = { tone: BadgeToneT; appearance?: BadgeAppearanceT }

function badgeVariants({ tone, appearance = 'soft' }: BadgeVariantsT) {
  return cn(
    'inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium',
    appearance === 'outline' ? ['border', BADGE_OUTLINE_TONES[tone]] : SOFT_TONES[tone],
  )
}

type BadgePropsT = React.ComponentProps<'span'> & BadgeVariantsT

export function Badge({ tone, appearance, className, ...props }: BadgePropsT) {
  return <span className={cn(badgeVariants({ tone, appearance }), className)} {...props} />
}

type BadgeButtonPropsT = React.ComponentProps<'button'> & BadgeVariantsT

export function BadgeButton({ tone, appearance, className, ...props }: BadgeButtonPropsT) {
  return (
    <button
      type="button"
      className={cn(
        badgeVariants({ tone, appearance }),
        'focus-visible:ring-ring/50 cursor-pointer outline-none hover:opacity-70 focus-visible:ring-3',
        className,
      )}
      {...props}
    />
  )
}
