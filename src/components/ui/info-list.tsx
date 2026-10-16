import { cn } from '@/lib/utils/cn'

type InfoListPropsT = {
  items: { label: string; value: React.ReactNode }[]
  layout?: 'inline' | 'stacked'
  className?: string
}

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
          <dt className="text-muted-foreground font-medium">{item.label}</dt>
          <dd className="text-foreground">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
