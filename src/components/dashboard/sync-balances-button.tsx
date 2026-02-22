'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toastMessage } from '@/components/toasts'
import { recalculateBalancesAction } from '@/lib/actions/recalculate-balances'

export function SyncBalancesButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSync() {
    startTransition(async () => {
      const result = await recalculateBalancesAction()
      if (result.success) {
        toastMessage(result.message, 'success')
        router.refresh()
      } else {
        toastMessage(result.error, 'error')
      }
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={isPending}>
      <RefreshCw className={isPending ? 'animate-spin' : ''} />
      {isPending ? 'Synchronizacja...' : 'Synchronizuj salda'}
    </Button>
  )
}
