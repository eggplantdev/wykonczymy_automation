'use client'

import { Calendar } from 'lucide-react'
import { ClearButton } from '@/components/filters/clear-button'
import { DateFilterButton } from '@/components/filters/date-filter-button'
import { ControlGrid } from '@/components/ui/control-grid'
import { FilterSelect } from '@/components/filters/filter-select'
import { Loader } from '@/components/ui/loader/loader'
import { MONTHS } from '@/lib/constants/months'
import { getMonthDateRange } from '@/lib/utils/date'
import { ALL_TIME, type DateRangeT } from '@/lib/utils/date-range'

const YEARS_OFFERED = 5

type DateRangePickerPropsT = {
  value: DateRangeT
  onChange: (next: DateRangeT) => void
  /** Only a caller whose write costs a round trip has anything to report; local state never does. */
  isPending?: boolean
}

/**
 * The window picker itself — controlled, and deliberately ignorant of where the window is kept.
 * `DateFilters` binds it to the URL for a listing somebody links to; a surface whose window is nobody
 * else's business binds it to local state. One picker, two bindings.
 */
export function DateRangePicker({ value, onChange, isPending = false }: DateRangePickerPropsT) {
  const now = new Date()

  // Rok/Miesiąc are a shortcut for writing `from`/`to`, not a third piece of state — they read back
  // off `from`, so a window typed into Od/Do still shows the month it belongs to.
  const anchor = value.from ? new Date(value.from + 'T00:00:00') : null
  const pickerMonth = anchor ? String(anchor.getMonth() + 1) : ''
  const pickerYear = anchor ? String(anchor.getFullYear()) : ''

  function handleMonthChange(month: string) {
    if (!month) return onChange(ALL_TIME)
    onChange(getMonthDateRange(Number(month), pickerYear ? Number(pickerYear) : now.getFullYear()))
  }

  function handleYearChange(year: string) {
    if (!year) return onChange(ALL_TIME)
    onChange(
      getMonthDateRange(pickerMonth ? Number(pickerMonth) : now.getMonth() + 1, Number(year)),
    )
  }

  const currentYear = now.getFullYear()
  const years = Array.from({ length: YEARS_OFFERED }, (_, index) => currentYear - index)

  return (
    <ControlGrid>
      <Loader loading={isPending} portal />

      <FilterSelect
        value={pickerYear}
        onValueChange={handleYearChange}
        options={years.map((year) => ({ value: String(year), label: String(year) }))}
        placeholder="Rok"
        icon={Calendar}
      />

      <FilterSelect
        value={pickerMonth}
        onValueChange={handleMonthChange}
        options={MONTHS.map((label, index) => ({ value: String(index + 1), label }))}
        placeholder="Miesiąc"
        icon={Calendar}
      />

      <DateFilterButton
        label="Od"
        value={value.from ?? ''}
        onChange={(from) => onChange({ ...value, from: from || undefined })}
      />
      <DateFilterButton
        label="Do"
        value={value.to ?? ''}
        onChange={(to) => onChange({ ...value, to: to || undefined })}
      />

      <ClearButton onClick={() => onChange(ALL_TIME)} disabled={!value.from && !value.to}>
        Wyczyść daty
      </ClearButton>
    </ControlGrid>
  )
}
