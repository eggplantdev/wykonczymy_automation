'use client'

import { Calendar } from 'lucide-react'
import { ClearButton } from '@/components/filters/clear-button'
import { DateFilterButton } from '@/components/filters/date-filter-button'
import { ControlGrid } from '@/components/ui/control-grid'
import { FilterSelect } from '@/components/filters/filter-select'
import { Loader } from '@/components/ui/loader/loader'
import { useTranslation } from '@/hooks/use-translation'
import { getMonthDateRange } from '@/lib/utils/date'
import { ALL_TIME, type DateRangeT } from '@/lib/utils/date-range'

const YEARS_OFFERED = 5
const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

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
  const { t } = useTranslation('filters')
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
        placeholder={t('year')}
        icon={Calendar}
      />

      <FilterSelect
        value={pickerMonth}
        onValueChange={handleMonthChange}
        options={MONTH_NUMBERS.map((month) => ({
          value: String(month),
          label: t(`month_${month}`),
        }))}
        placeholder={t('month')}
        icon={Calendar}
      />

      <DateFilterButton
        label={t('from')}
        value={value.from ?? ''}
        onChange={(from) => onChange({ ...value, from: from || undefined })}
      />
      <DateFilterButton
        label={t('to')}
        value={value.to ?? ''}
        onChange={(to) => onChange({ ...value, to: to || undefined })}
      />

      <ClearButton onClick={() => onChange(ALL_TIME)} disabled={!value.from && !value.to}>
        {t('clearDates')}
      </ClearButton>
    </ControlGrid>
  )
}
