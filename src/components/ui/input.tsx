import * as React from 'react'

import { cn } from '@/lib/utils/cn'

// Value is 16px below `sm`, 14px above: iOS Safari zooms in on focus below 16px and never zooms back out.
export const INPUT_CLASS =
  'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input bg-background text-foreground typing-surface h-9 w-full min-w-0 rounded-md border px-3 shadow-sm transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive aria-invalid:border-2'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        INPUT_CLASS,
        'file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
