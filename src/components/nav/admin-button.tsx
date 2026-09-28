'use client'

import { Shield } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isManagementRole } from '@/lib/auth/roles'
import { cn } from '@/lib/utils/cn'

type AdminButtonPropsT = React.ComponentProps<typeof Button> & {
  collapsed?: boolean
}

export function AdminButton({ collapsed = false, ...props }: AdminButtonPropsT) {
  const user = useCurrentUser()

  // Mirrors `users.access.admin` — Payload refuses the panel to everyone else anyway.
  if (!isManagementRole(user.role)) return null

  return (
    <Button {...props} variant="outline" size="sm" className={cn(collapsed && 'px-0')} asChild>
      {/* Relative on purpose: FRONTEND_URL is ONE value for the whole project, so an absolute link
          would open the production Payload panel — which writes to the live database — from staging
          and every preview. */}
      <Link href="/admin" target="_blank" aria-label="Panel administracyjny">
        <Shield />
        {!collapsed && 'Admin'}
      </Link>
    </Button>
  )
}
