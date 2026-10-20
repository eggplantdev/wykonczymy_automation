import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

export function NavNameLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn('text-foreground text-sm font-medium hover:underline', className)}
      {...props}
    />
  )
}
