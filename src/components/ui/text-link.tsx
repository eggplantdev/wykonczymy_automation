import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'

import { cn } from '@/lib/utils/cn'

type TextActionPropsT = React.ComponentProps<'button'> & { asChild?: boolean }

export function TextLink({ className, asChild = false, ...props }: TextActionPropsT) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="text-link"
      {...(!asChild && { type: 'button' })}
      className={cn(
        'text-primary cursor-pointer text-sm underline underline-offset-4 hover:opacity-80',
        className,
      )}
      {...props}
    />
  )
}

export function TextButton({ className, asChild = false, ...props }: TextActionPropsT) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="text-button"
      {...(!asChild && { type: 'button' })}
      className={cn(
        'text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs transition-colors disabled:cursor-default disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
