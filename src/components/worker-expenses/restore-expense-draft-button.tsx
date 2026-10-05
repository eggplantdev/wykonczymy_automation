'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { restoreExpenseDraftAction } from '@/lib/actions/worker-expense-drafts'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

export function RestoreExpenseDraftButton({ draftId }: { draftId: number }) {
  const router = useRouter()
  const [isRestoring, setIsRestoring] = useState(false)

  async function handleRestore() {
    setIsRestoring(true)
    try {
      const result = await settleAction(() => restoreExpenseDraftAction(draftId))
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      toastMessage('Zgłoszenie przywrócone')
      router.refresh()
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={isRestoring} onClick={handleRestore}>
      {isRestoring && <Loader2 className="animate-spin" />}
      Przywróć
    </Button>
  )
}
