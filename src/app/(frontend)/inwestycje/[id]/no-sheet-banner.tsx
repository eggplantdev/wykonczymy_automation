'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toastMessage } from '@/components/toasts'
import { provisionKosztorysAction } from '@/lib/actions/investments'

type PropsT = { investmentId: number; investmentName: string }

export function NoSheetBanner({ investmentId, investmentName }: PropsT) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const onProvision = () => {
    startTransition(async () => {
      const res = await provisionKosztorysAction(investmentId)
      if (!res.success) {
        toastMessage(res.error, 'error')
        return
      }
      toastMessage(`Utworzono kosztorys dla "${investmentName}".`, 'success')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span>
        Inwestycja <strong>{investmentName}</strong> nie ma jeszcze powiązanego kosztorysu.
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/collections/investments/${investmentId}`}>
            Powiąż istniejący arkusz
          </Link>
        </Button>
        <Button size="sm" onClick={onProvision} disabled={pending}>
          {pending ? 'Tworzę…' : 'Utwórz nowy kosztorys'}
        </Button>
      </div>
    </div>
  )
}
