import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

type AuthLinkPropsT = {
  href: string
  children: React.ReactNode
  className?: string
}

export function AuthLink({ href, children, className }: AuthLinkPropsT) {
  return (
    <Link
      href={href}
      className={cn(
        'text-muted-foreground hover:text-foreground text-center text-sm transition-colors',
        className,
      )}
    >
      {children}
    </Link>
  )
}
