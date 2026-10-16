import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

type OptionalLinkPropsT = {
  href: string | null | undefined
  children: ReactNode
  className?: string
  target?: '_blank'
}

export function OptionalLink({ href, children, className, target }: OptionalLinkPropsT) {
  if (!href) return children
  return (
    <Link href={href} target={target} className={cn('hover:underline', className)}>
      {children}
    </Link>
  )
}
