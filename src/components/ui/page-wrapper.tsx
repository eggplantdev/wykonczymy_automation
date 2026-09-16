import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type PageWrapperPropsT = {
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

export function PageWrapper({ title, description, children, className }: PageWrapperPropsT) {
  // [&>*]:min-w-0 — a grid item's default `min-width: auto` refuses to shrink below its content's
  // min-content width, so a wide child (the transfer table, the filter row) grew past the viewport
  // instead of letting its own overflow-x-auto engage. Same failure the flex column in
  // (frontend)/layout.tsx solves with min-w-0.
  return (
    <div className={cn('grid grid-cols-1 gap-6 p-4 sm:p-6 lg:p-8 [&>*]:min-w-0', className)}>
      <h1 className="text-foreground text-2xl font-semibold">{title}</h1>

      {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}

      {children}
    </div>
  )
}
