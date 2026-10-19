'use client'

import { CircleDot, Landmark } from 'lucide-react'
import { FilterMultiSelect, type FilterOptionT } from '@/components/filters/filter-multi-select'
import { ControlGrid } from '@/components/ui/control-grid'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useClientPagination } from '@/hooks/use-client-pagination'
import { useTranslation } from '@/hooks/use-translation'

type OptionsT<T> = {
  rows: T[]
  getStatus: (row: T) => string
  getInvestment: (row: T) => string
  getInvestmentLabel: (row: T) => string
  statusOptions: FilterOptionT[]
  defaultStatus?: string[]
}

// Filters and page stay in state: the page also filters transfers by `investment` through the URL.
export function useStatusInvestmentFilters<T>({
  rows,
  getStatus,
  getInvestment,
  getInvestmentLabel,
  statusOptions,
  defaultStatus,
}: OptionsT<T>) {
  const { t } = useTranslation('expenseDrafts')
  const {
    filteredData: byStatus,
    values: statusFilter,
    setValues: setStatusFilter,
  } = useClientMultiFilter(rows, getStatus, defaultStatus)
  const {
    filteredData: filtered,
    values: investmentFilter,
    setValues: setInvestmentFilter,
  } = useClientMultiFilter(byStatus, getInvestment)
  const { pageRows, narrow, setPage, bar } = useClientPagination(filtered)

  const investmentOptions = [
    ...new Map(rows.map((row) => [getInvestment(row), getInvestmentLabel(row)])),
  ]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))

  const controls = (
    <ControlGrid>
      <FilterMultiSelect
        values={statusFilter}
        onValuesChange={(values) => narrow(() => setStatusFilter(values))}
        options={statusOptions}
        label={t('status')}
        icon={CircleDot}
      />
      <FilterMultiSelect
        values={investmentFilter}
        onValuesChange={(values) => narrow(() => setInvestmentFilter(values))}
        options={investmentOptions}
        label={t('investment')}
        icon={Landmark}
        searchable
      />
    </ControlGrid>
  )

  return { filtered, pageRows, setPage, bar, controls }
}
