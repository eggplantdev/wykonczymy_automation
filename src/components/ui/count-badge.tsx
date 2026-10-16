type CountBadgePropsT = {
  count: number
}

export function CountBadge({ count }: CountBadgePropsT) {
  if (count === 0) return null

  return (
    <span className="bg-primary text-primary-foreground ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  )
}
