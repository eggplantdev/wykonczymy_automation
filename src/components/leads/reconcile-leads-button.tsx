'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toastMessage } from '@/lib/utils/toast'
import { reconcileLeads } from '@/lib/actions/reconcile-leads'

export function ReconcileLeadsButton() {
  const [isPending, setIsPending] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setIsPending(true)
    const result = await reconcileLeads()
    setIsPending(false)

    if (!result.success) {
      toastMessage(result.error, 'error')
      return
    }

    const { added } = result.data
    toastMessage(added > 0 ? `Dodano ${added} nowych zgłoszeń` : 'Brak nowych zgłoszeń', 'success')
    if (added > 0) router.refresh()
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isPending}>
      <RefreshCw className={isPending ? 'animate-spin' : undefined} />
      {isPending ? 'Pobieranie...' : 'Pobierz z Facebooka'}
    </Button>
  )
}
