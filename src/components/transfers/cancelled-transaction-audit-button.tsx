'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { buildUrlWithParams } from '@/lib/build-url-with-params'

type CancelledTransactionAuditButtonPropsT = {
  baseUrl: string
}

export function CancelledTransactionAuditButton({
  baseUrl,
}: CancelledTransactionAuditButtonPropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const isCancelledTransactionAudit = searchParams.get('cancelledTransactionAudit') === '1'

  function toggle(nextActive: boolean) {
    const overrides: Record<string, string> = {
      cancelledTransactionAudit: nextActive ? '1' : '',
      page: '',
    }
    // Entering audit mode clears type + showCancelled (audit overrides them)
    if (nextActive) {
      overrides.type = ''
      overrides.showCancelled = ''
    }
    const url = buildUrlWithParams(baseUrl, searchParams.toString(), overrides)
    startTransition(() => router.replace(url, { scroll: false }))
  }

  return (
    <ActiveFilterButton
      isActive={isCancelledTransactionAudit}
      onChange={toggle}
      activeLabel="Tryb anulowań"
      allLabel="Tryb anulowań"
    />
  )
}
