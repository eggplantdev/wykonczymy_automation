'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'

/**
 * Writes filter state into the URL, so a filtered view is a link somebody can send.
 *
 * Every write resets `page` — page 7 of an unfiltered list is rarely page 7 of the filtered one, and
 * landing on an empty page reads as "the filter found nothing".
 */
export function useUrlFilterParams(baseUrl: string) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function updateMultipleParams(overrides: Record<string, string>) {
    const url = buildUrlWithParams(baseUrl, searchParams.toString(), { ...overrides, page: '' })
    startTransition(() => {
      router.replace(url, { scroll: false })
    })
  }

  return {
    getMultiParam: (key: string) => (searchParams.get(key) ?? '').split(',').filter(Boolean),
    updateParam: (key: string, value: string) => updateMultipleParams({ [key]: value }),
    updateMultipleParams,
    isPending,
  }
}
