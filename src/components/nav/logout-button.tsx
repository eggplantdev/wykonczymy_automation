'use client'

import { LogOut } from 'lucide-react'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { logoutAction } from '@/lib/actions/auth'
import { cn } from '@/lib/utils/cn'

type LogoutButtonPropsT = {
  collapsed?: boolean
  /** Runs before the redirect tears the shell down — the drawer uses it to release its scroll lock. */
  beforeLogout?: () => void
}

export function LogoutButton({ collapsed = false, beforeLogout }: LogoutButtonPropsT) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(collapsed && 'px-0')}
      onClick={() => {
        beforeLogout?.()
        startTransition(() => logoutAction())
      }}
      disabled={isPending}
      aria-label="Wyloguj"
    >
      <LogOut />
      {!collapsed && 'Wyloguj'}
    </Button>
  )
}
