'use client'

import type { ComponentPropsWithoutRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

type PropsT = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'inputMode'>

export function DecimalInput({ className, ...props }: PropsT) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      className={cn('h-7 w-20 px-1 text-right', className)}
      {...props}
    />
  )
}
