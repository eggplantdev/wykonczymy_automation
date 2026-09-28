'use client'

import { Shield } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isManagementRole } from '@/lib/auth/roles'
import { cn } from '@/lib/utils/cn'

type AdminButtonPropsT = {
  collapsed?: boolean
}

export function AdminButton({ collapsed = false }: AdminButtonPropsT) {
  const user = useCurrentUser()

  // Mirrors `users.access.admin` — Payload refuses the panel to everyone else anyway.
  if (!isManagementRole(user.role)) return null

  return (
    <Button variant="outline" size="sm" className={cn(collapsed && 'px-0')} asChild>
      {/* Relative on purpose: built off FRONTEND_URL it was absolute, and that is ONE value for the
          whole project — so on staging and on every preview it opened the production Payload panel,
          which writes to the live database. */}
      <Link href="/admin" target="_blank" aria-label="Panel administracyjny">
        <Shield />
        {!collapsed && 'Admin'}
      </Link>
    </Button>
  )
}
