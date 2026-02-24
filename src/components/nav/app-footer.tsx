'use client'

import { useTransition } from 'react'
import { LogOut, Shield } from 'lucide-react'
import Link from 'next/link'
import { logoutAction } from '@/lib/actions/auth'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { RoleBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

type AppFooterPropsT = {
  user: {
    name: string
    role: RoleT
  }
}

export function AppFooter({ user }: AppFooterPropsT) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleLogout = () => {
    startTransition(() => logoutAction())
  }

  return (
    <footer className="border-border bg-background border-t px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-medium">{user.name}</span>
          <RoleBadge role={user.role}>{ROLE_LABELS[user.role].pl}</RoleBadge>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild aria-label="Panel administracyjny">
            <Link
              href={`${process.env.NEXT_PUBLIC_FRONTEND_URL}/admin`}
              target="_blank"
              aria-label="Panel administracyjny"
            >
              <Shield className="size-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </Button>
          <Button
            onMouseEnter={() => router.prefetch('/zaloguj')}
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isPending}
            aria-label="Wyloguj"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Wyloguj</span>
          </Button>
        </div>
      </div>
    </footer>
  )
}
