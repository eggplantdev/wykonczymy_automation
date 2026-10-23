import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'

import { cn } from '@/lib/utils/cn'

type LabelSizeT = 'sm' | 'xs'
type LabelToneT = 'default' | 'muted'

const SIZE: Record<LabelSizeT, string> = {
  sm: 'text-sm leading-none font-medium',
  xs: 'gap-1 text-xs leading-normal font-normal',
}

const TONE: Record<LabelToneT, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
}

function Label({
  className,
  size = 'sm',
  tone = 'default',
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & { size?: LabelSizeT; tone?: LabelToneT }) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        TONE[tone],
        SIZE[size],
        className,
      )}
      {...props}
    />
  )
}

export { Label }
