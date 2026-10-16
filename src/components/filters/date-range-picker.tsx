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
  isPending?: boolean
  stacked?: boolean
}

export function DateRangePicker({
  value,
  onChange,
  isPending = false,
  stacked = false,
}: DateRangePickerPropsT) {
  const { t } = useTranslation('filters')
  const now = new Date()

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
    <ControlGrid className={stacked ? 'sm:grid' : undefined}>
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
