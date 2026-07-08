type CountBadgePropsT = {
  count: number
}

/**
 * Presentational count bubble — a small circular pill showing a number, capped at
 * "99+". Renders nothing at 0. No feature logic: callers own what the number means.
 */
export function CountBadge({ count }: CountBadgePropsT) {
  if (count === 0) return null

  return (
    <span className="bg-primary text-primary-foreground ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  )
}
