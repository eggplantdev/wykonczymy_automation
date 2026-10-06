'use client'

import { RefreshCw } from 'lucide-react'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { useI18nContext, useTranslation } from '@/hooks/use-translation'
import { failureMessage } from '@/lib/i18n/failure-message'
import { refreshDataAction } from '@/lib/actions/refresh'
import { cn } from '@/lib/utils/cn'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type RefreshDataButtonPropsT = React.ComponentProps<typeof Button> & {
  collapsed?: boolean
}

export function RefreshDataButton({ collapsed = false, ...props }: RefreshDataButtonPropsT) {
  const [isRefreshing, startRefreshTransition] = useTransition()
  const { locale } = useI18nContext()
  const { t } = useTranslation('shell')

  return (
    <Button
      {...props}
      variant="outline"
      size="sm"
      className={cn(collapsed && 'px-0')}
      onClick={() =>
        startRefreshTransition(async () => {
          const res = await settleAction(refreshDataAction)
          if (!res.success) return toastMessage(failureMessage(locale, res), 'error')
          toastMessage(t('dataRefreshed'))
        })
      }
      disabled={isRefreshing}
      aria-label={t('refreshData')}
    >
      <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
      {!collapsed && t('refreshData')}
    </Button>
  )
}
