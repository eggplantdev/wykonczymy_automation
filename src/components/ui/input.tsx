import * as React from 'react'

import { cn } from '@/lib/utils/cn'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input bg-background text-foreground h-9 w-full min-w-0 rounded-md border px-3 text-sm transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'focus-visible:ring-none',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive aria-invalid:border-2',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
