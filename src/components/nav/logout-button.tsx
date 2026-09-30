'use client'

import { LogOut } from 'lucide-react'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { logoutAction } from '@/lib/actions/auth'
import { cn } from '@/lib/utils/cn'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type LogoutButtonPropsT = React.ComponentProps<typeof Button> & {
  collapsed?: boolean
  /** Runs before the redirect tears the shell down — the drawer uses it to release its scroll lock. */
  beforeLogout?: () => void
}

export function LogoutButton({ collapsed = false, beforeLogout, ...props }: LogoutButtonPropsT) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      {...props}
      variant="outline"
      size="sm"
      className={cn(collapsed && 'px-0')}
      onClick={() => {
        beforeLogout?.()
        startTransition(async () => {
          // Only a failed request ever returns — a logout that lands redirects.
          const res = await settleAction(logoutAction)
          toastMessage(res.error, 'error')
        })
      }}
      disabled={isPending}
      aria-label="Wyloguj"
    >
      <LogOut />
      {!collapsed && 'Wyloguj'}
    </Button>
  )
}
