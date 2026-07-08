'use client'

import { useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { FilterGrid } from '@/components/ui/filter-grid'
import { FilterSelect } from '@/components/transfers/filter-select'
import { DateFilterButton } from '@/components/transfers/date-filter-button'
import { ClearButton } from '@/components/transfers/clear-button'
import { MONTHS } from '@/lib/constants/months'
import { getMonthDateRange } from '@/lib/utils/date'

type DateFiltersPropsT = {
  updateParam: (key: string, value: string) => void
  updateMultipleParams: (overrides: Record<string, string>) => void
}

export function DateFilters({ updateParam, updateMultipleParams }: DateFiltersPropsT) {
  const searchParams = useSearchParams()
  const currentFrom = searchParams.get('from') ?? ''
  const currentTo = searchParams.get('to') ?? ''

  const now = new Date()
  const pickerMonth = currentFrom ? String(new Date(currentFrom + 'T00:00:00').getMonth() + 1) : ''
  const pickerYear = currentFrom ? String(new Date(currentFrom + 'T00:00:00').getFullYear()) : ''

  function updateDateRange(month: number, year: number) {
    const { from, to } = getMonthDateRange(month, year)
    updateMultipleParams({ from, to })
  }

  function handleMonthChange(value: string) {
    if (!value) return updateMultipleParams({ from: '', to: '' })
    updateDateRange(Number(value), pickerYear ? Number(pickerYear) : now.getFullYear())
  }

  function handleYearChange(value: string) {
    if (!value) return updateMultipleParams({ from: '', to: '' })
    updateDateRange(pickerMonth ? Number(pickerMonth) : now.getMonth() + 1, Number(value))
  }

  const currentYear = now.getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const hasDateFilters = currentFrom || currentTo

  return (
    <FilterGrid className={`lg:grid-cols-5`}>
      <FilterSelect
        value={pickerYear}
        onValueChange={handleYearChange}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
        placeholder="Rok"
        icon={Calendar}
      />

      <FilterSelect
        value={pickerMonth}
        onValueChange={handleMonthChange}
        options={MONTHS.map((label, i) => ({ value: String(i + 1), label }))}
        placeholder="Miesiąc"
        icon={Calendar}
      />

      <DateFilterButton label="Od" value={currentFrom} onChange={(v) => updateParam('from', v)} />
      <DateFilterButton label="Do" value={currentTo} onChange={(v) => updateParam('to', v)} />

      <ClearButton
        onClick={() => updateMultipleParams({ from: '', to: '' })}
        disabled={!hasDateFilters}
      >
        Wyczyść daty
      </ClearButton>
    </FilterGrid>
  )
}
