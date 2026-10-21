import { EMPTY_VALUE } from '@/lib/utils/empty-value'
import { cn } from '@/lib/utils/cn'

type InfoListPropsT = {
  items: { label: string; value: React.ReactNode }[]
  layout?: 'inline' | 'stacked'
  className?: string
}

const ROW = 'flex min-h-7 items-center'

export function InfoList({ items, layout = 'inline', className }: InfoListPropsT) {
  const stacked = layout === 'stacked'

  return (
    <dl
      className={cn(
        'text-sm',
        stacked ? 'space-y-4' : 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-2',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className={stacked ? 'space-y-1' : 'contents'}>
          <dt className={cn('text-muted-foreground font-medium', !stacked && ROW)}>{item.label}</dt>
          <dd className={cn('text-foreground', !stacked && ROW)}>{item.value || EMPTY_VALUE}</dd>
        </div>
      ))}
    </dl>
  )
}
