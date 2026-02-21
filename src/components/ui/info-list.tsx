import { cn } from '@/lib/cn'

type InfoListPropsT = {
  items: { label: string; value: React.ReactNode }[]
  className?: string
}

export function InfoList({ items, className }: InfoListPropsT) {
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm', className)}>
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground font-medium">{item.label}</dt>
          <dd className="text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
