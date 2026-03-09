import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type NavGroupWrapperPropsT = {
  className?: string
  children: ReactNode
  style?: CSSProperties
}

export function NavGroupWrapper({ children, className, style }: NavGroupWrapperPropsT) {
  return (
    <div
      style={style}
      className={cn('border-border flex items-center rounded-lg border bg-white p-1', className)}
    >
      {children}
    </div>
  )
}
