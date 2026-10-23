import Link from 'next/link'
import { TextButton } from '@/components/ui/text-link'
import { cn } from '@/lib/utils/cn'

type AuthLinkPropsT = {
  href: string
  children: React.ReactNode
  className?: string
}

export function AuthLink({ href, children, className }: AuthLinkPropsT) {
  return (
    <TextButton asChild className={cn('justify-center text-center text-sm', className)}>
      <Link href={href}>{children}</Link>
    </TextButton>
  )
}
