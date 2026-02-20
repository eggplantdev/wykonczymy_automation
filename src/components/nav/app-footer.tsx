'use client'

import { useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { logoutAction } from '@/lib/actions/auth'
import { ROLE_LABELS, type RoleT } from '@/lib/auth/roles'
import { Button } from '@/components/ui/button'

type AppFooterPropsT = {
  user: {
    name: string
    role: RoleT
  }
}

export function AppFooter({ user }: AppFooterPropsT) {
  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(() => logoutAction())
  }

  return (
    <footer className="border-border bg-background border-t px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-medium">{user.name}</span>
          <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-xs">
            {ROLE_LABELS[user.role].pl}
          </span>
        </div>
        <Button
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
    </footer>
  )
}
