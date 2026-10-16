'use client'

import { LogOut } from 'lucide-react'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { useI18nContext, useTranslation } from '@/hooks/use-translation'
import { failureMessage } from '@/lib/i18n/failure-message'
import { logoutAction } from '@/lib/actions/auth'
import { unsubscribeThisDevice } from '@/lib/push/push-client'
import { cn } from '@/lib/utils/cn'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

const UNSUBSCRIBE_WAIT_MS = 3_000

type LogoutButtonPropsT = React.ComponentProps<typeof Button> & {
  collapsed?: boolean
  beforeLogout?: () => void
}

export function LogoutButton({ collapsed = false, beforeLogout, ...props }: LogoutButtonPropsT) {
  const [isPending, startTransition] = useTransition()
  const { locale } = useI18nContext()
  const { t } = useTranslation('shell')

  return (
    <Button
      {...props}
      variant="outline"
      size="sm"
      className={cn(collapsed && 'px-0')}
      onClick={() => {
        beforeLogout?.()
        startTransition(async () => {
          // A shared phone must stop receiving the previous account's pushes — but a push service
          // stalled on site signal must not hold the logout.
          await Promise.race([
            unsubscribeThisDevice(),
            new Promise((resolve) => setTimeout(resolve, UNSUBSCRIBE_WAIT_MS)),
          ])
          const res = await settleAction(logoutAction)
          if (!res.success) toastMessage(failureMessage(locale, res), 'error')
        })
      }}
      disabled={isPending}
      aria-label={t('logout')}
    >
      <LogOut />
      {!collapsed && t('logout')}
    </Button>
  )
}
