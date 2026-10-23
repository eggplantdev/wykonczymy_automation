import type { ReactNode } from 'react'
import { Button, type ButtonPropsT } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { TextButton } from '@/components/ui/text-link'

type ExternalLinkVariantT = 'text' | 'button'

type ExternalLinkPropsT = {
  href: string
  children: ReactNode
  variant?: ExternalLinkVariantT
  size?: ButtonPropsT['size']
  buttonVariant?: ButtonPropsT['variant']
  className?: string
}

export function ExternalLink({
  href,
  children,
  variant = 'text',
  size = 'touch',
  buttonVariant,
  className,
}: ExternalLinkPropsT) {
  const anchor = (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )

  if (variant === 'button') {
    return (
      <Button asChild size={size} variant={buttonVariant} className={className}>
        {anchor}
      </Button>
    )
  }

  return (
    <TextButton asChild className={cn('underline', className)}>
      {anchor}
    </TextButton>
  )
}
