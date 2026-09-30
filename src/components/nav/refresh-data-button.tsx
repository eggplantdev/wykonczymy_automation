'use client'

import { RefreshCw } from 'lucide-react'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { refreshDataAction } from '@/lib/actions/refresh'
import { cn } from '@/lib/utils/cn'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type RefreshDataButtonPropsT = React.ComponentProps<typeof Button> & {
  collapsed?: boolean
}

export function RefreshDataButton({ collapsed = false, ...props }: RefreshDataButtonPropsT) {
  const [isRefreshing, startRefreshTransition] = useTransition()

  return (
    <Button
      {...props}
      variant="outline"
      size="sm"
      className={cn(collapsed && 'px-0')}
      onClick={() =>
        startRefreshTransition(async () => {
          const res = await settleAction(refreshDataAction)
          if (!res.success) return toastMessage(res.error, 'error')
          toastMessage('Dane odświeżone')
        })
      }
      disabled={isRefreshing}
      aria-label="Odśwież dane"
    >
      <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
      {!collapsed && 'Odśwież dane'}
    </Button>
  )
}
