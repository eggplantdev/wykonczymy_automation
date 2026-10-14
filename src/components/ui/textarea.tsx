import * as React from 'react'

import { cn } from '@/lib/utils/cn'

// Safari before 26.2 ignores `field-sizing: content`, so a controlled textarea would sit at its
// min-height there. One row per hard line break, plus one to type into; a soft-wrapped paragraph still
// comes out a little short. A caller's `rows` stays the floor.
function fallbackRows(value: React.ComponentProps<'textarea'>['value'], rows: number | undefined) {
  if (typeof value !== 'string') return rows
  return Math.max(rows ?? 0, value.split('\n').length + 1)
}

function Textarea({ className, value, rows, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive bg-background text-foreground typing-surface flex field-sizing-content min-h-[68px] w-full rounded-md border px-3 py-2 transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2',
        className,
      )}
      value={value}
      rows={fallbackRows(value, rows)}
      {...props}
    />
  )
}

export { Textarea }
