import { EMPTY_VALUE } from '@/lib/utils/empty-value'
import { cn } from '@/lib/utils/cn'

type EmptyValuePropsT = {
  size?: 'xs'
}

export function EmptyValue({ size }: EmptyValuePropsT) {
  return (
    <span className={cn('text-muted-foreground', size === 'xs' && 'text-xs')}>{EMPTY_VALUE}</span>
  )
}
