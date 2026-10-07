'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

type PropsT = {
  restore: () => Promise<ActionResultT>
  successMessage: string
}

export function RestoreExpenseDraftButton({ restore, successMessage }: PropsT) {
  const router = useRouter()
  const [isRestoring, setIsRestoring] = useState(false)

  async function handleRestore() {
    setIsRestoring(true)
    try {
      const result = await settleAction(restore)
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      toastMessage(successMessage)
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
