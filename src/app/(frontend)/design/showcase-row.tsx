import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type ShowcaseRowPropsT = {
  title: string
  source: string
  children: ReactNode
  className?: string
}

export function ShowcaseRow({ title, source, children, className }: ShowcaseRowPropsT) {
  return (
    <div className="flex flex-col gap-2 border-b py-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <code className="text-muted-foreground text-xs">{source}</code>
      </div>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
    </div>
  )
}
