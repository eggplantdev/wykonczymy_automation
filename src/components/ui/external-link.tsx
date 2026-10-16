import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type ExternalLinkVariantT = 'text' | 'button'

type ExternalLinkPropsT = {
  href: string
  children: ReactNode
  variant?: ExternalLinkVariantT
  className?: string
}

const VARIANT_CLASSES = {
  text: 'text-muted-foreground hover:text-foreground text-xs underline',
  button:
    'bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-medium',
} as const

export function ExternalLink({ href, children, variant = 'text', className }: ExternalLinkPropsT) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(VARIANT_CLASSES[variant], className)}
    >
      {children}
    </a>
  )
}
