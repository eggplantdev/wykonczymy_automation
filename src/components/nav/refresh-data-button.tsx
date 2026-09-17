'use client'

import { RefreshCw } from 'lucide-react'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { refreshDataAction } from '@/lib/actions/refresh'
import { cn } from '@/lib/utils/cn'
import { toastMessage } from '@/lib/utils/toast'

type RefreshDataButtonPropsT = {
  collapsed?: boolean
}

export function RefreshDataButton({ collapsed = false }: RefreshDataButtonPropsT) {
  const [isRefreshing, startRefreshTransition] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(collapsed && 'px-0')}
      onClick={() =>
        startRefreshTransition(async () => {
          await refreshDataAction()
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
