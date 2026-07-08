'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'

type UseToggleSearchParamOptsT = {
  /** Extra params to clear when turning ON. */
  clearOnEnable?: string[]
}

export function useToggleSearchParam(
  baseUrl: string,
  paramKey: string,
  opts: UseToggleSearchParamOptsT = {},
) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const isActive = searchParams.get(paramKey) === '1'

  function setActive(next: boolean) {
    const overrides: Record<string, string> = {
      [paramKey]: next ? '1' : '',
      page: '',
    }
    if (next) {
      for (const key of opts.clearOnEnable ?? []) overrides[key] = ''
    }
    const url = buildUrlWithParams(baseUrl, searchParams.toString(), overrides)
    startTransition(() => router.replace(url, { scroll: false }))
  }

  return { isActive, setActive }
}
