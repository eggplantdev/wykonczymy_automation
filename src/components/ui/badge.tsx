import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

export const badgeVariants = cva(
  'inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
        pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        negative: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        muted: 'bg-muted text-muted-foreground',
        destructive: 'bg-destructive/10 text-destructive',
        sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
        violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
        orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
        cyan: 'bg-neon-cyan/15 text-cyan-700 dark:text-neon-cyan',
      },
    },
  },
)

export type BadgeToneT = NonNullable<VariantProps<typeof badgeVariants>['tone']>

type BadgePropsT = React.ComponentProps<'span'> & { tone: BadgeToneT }

export function Badge({ tone, className, ...props }: BadgePropsT) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
