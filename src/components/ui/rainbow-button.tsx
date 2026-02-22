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
        'group flex h-10 cursor-pointer items-center justify-center rounded-full bg-linear-to-r from-purple-500 via-red-500 to-yellow-500 p-[1.5px] text-white transition duration-300 hover:shadow-2xl hover:shadow-purple-600/30',
        className,
      )}
      {...props}
    >
      <div className="flex h-full w-full items-center justify-center gap-1.5 rounded-full bg-gray-900 px-3 text-xs font-medium transition duration-300 ease-in-out group-hover:bg-linear-to-br group-hover:from-gray-700 group-hover:to-gray-900">
        {children}
      </div>
    </Comp>
  )
}
