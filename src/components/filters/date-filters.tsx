'use client'

import { useSearchParams } from 'next/navigation'
import { DateRangePicker } from '@/components/filters/date-range-picker'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import { urlDateRange } from '@/lib/utils/date-range'

export function DateFilters({ baseUrl }: { baseUrl: string }) {
  const searchParams = useSearchParams()
  const { updateMultipleParams, isPending } = useUrlFilterParams(baseUrl)

  return (
    <DateRangePicker
      value={urlDateRange(searchParams)}
      onChange={(next) => updateMultipleParams({ from: next.from ?? '', to: next.to ?? '' })}
      isPending={isPending}
    />
  )
}
