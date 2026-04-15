'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { buildUrlWithParams } from '@/lib/build-url-with-params'

type CancelledFilterButtonPropsT = {
  baseUrl: string
}

export function CancelledFilterButton({ baseUrl }: CancelledFilterButtonPropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const showCancelled = searchParams.get('showCancelled') === '1'

  function toggleCancelled(hideCancelled: boolean) {
    const url = buildUrlWithParams(baseUrl, searchParams.toString(), {
      showCancelled: hideCancelled ? '' : '1',
      page: '',
    })
    startTransition(() => router.replace(url, { scroll: false }))
  }

  return (
    <ActiveFilterButton
      isActive={!showCancelled}
      onChange={toggleCancelled}
      activeLabel="Anulowane ukryte"
      allLabel="Anulowane widoczne"
    />
  )
}
