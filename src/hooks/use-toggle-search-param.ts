'use client'

import { useSearchParams } from 'next/navigation'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'

export function useToggleSearchParam(baseUrl: string, paramKey: string) {
  const searchParams = useSearchParams()
  const { updateMultipleParams } = useUrlFilterParams(baseUrl)

  const isActive = searchParams.get(paramKey) === '1'

  function setActive(next: boolean) {
    updateMultipleParams({ [paramKey]: next ? '1' : '' })
  }

  return { isActive, setActive }
}
