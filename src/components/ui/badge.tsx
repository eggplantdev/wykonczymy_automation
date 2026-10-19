export const BADGE_BASE =
  'inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium '

export const BADGE_TONE = {
  positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  muted: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  negative: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
} as const
