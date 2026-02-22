import * as React from 'react'
import { cn } from '@/lib/cn'

type RainbowButtonPropsT<TElement extends React.ElementType = 'button'> = {
  as?: TElement
  className?: string
  children?: React.ReactNode
} & Omit<React.ComponentProps<TElement>, 'as' | 'className' | 'children'>

export function RainbowButton<TElement extends React.ElementType = 'button'>({
  as,
  className,
  children,
  ...props
}: RainbowButtonPropsT<TElement>) {
  const Comp = as ?? 'button'

  return (
    <Comp
      className={cn(
        'inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-semibold text-white transition duration-300 [background:linear-gradient(to_right,#e40303,#ff8c00,#ffed00,#008026,#004dff,#750787)] hover:shadow-[0_0_2rem_-0.25rem_#750787,0_0_2rem_-0.25rem_#750787]',
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  )
}
