'use client'

import { CircleDot, HardHat, Landmark } from 'lucide-react'
import { ControlGrid } from '@/components/ui/control-grid'
import { Loader } from '@/components/ui/loader/loader'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { ClearButton } from '@/components/filters/clear-button'
import { DateFilters } from '@/components/filters/date-filters'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import { REPORT_STATUSES, REPORT_STATUS_LABELS } from '@/lib/kosztorys/worker-report/report-status'
import type { ReferenceItemT } from '@/types/reference-data'

const FILTER_KEYS = ['status', 'investment', 'worker'] as const

const STATUS_OPTIONS = REPORT_STATUSES.map((status) => ({
  value: status,
  label: REPORT_STATUS_LABELS[status],
}))

const toOptions = (items: ReferenceItemT[]) =>
  items.map((item) => ({ value: String(item.id), label: item.name }))

type PropsT = {
  baseUrl: string
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
}

export function WorkerReportFilters({ baseUrl, investments, workers }: PropsT) {
  const { getMultiParam, updateParam, updateMultipleParams, isPending } =
    useUrlFilterParams(baseUrl)

  const hasFilters = FILTER_KEYS.some((key) => getMultiParam(key).length > 0)

  return (
    <div className="flex flex-col gap-3">
      <Loader loading={isPending} portal />
      <ControlGrid>
        <FilterMultiSelect
          values={getMultiParam('status')}
          onValuesChange={(values) => updateParam('status', values.join(','))}
          options={STATUS_OPTIONS}
          label="Status"
          icon={CircleDot}
        />
        <FilterMultiSelect
          values={getMultiParam('investment')}
          onValuesChange={(values) => updateParam('investment', values.join(','))}
          options={toOptions(investments)}
          label="Inwestycja"
          icon={Landmark}
          searchable
        />
        <FilterMultiSelect
          values={getMultiParam('worker')}
          onValuesChange={(values) => updateParam('worker', values.join(','))}
          options={toOptions(workers)}
          label="Pracownik"
          icon={HardHat}
          searchable
        />
        <ClearButton
          onClick={() =>
            updateMultipleParams(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])))
          }
          disabled={!hasFilters}
        >
          Wyczyść filtry
        </ClearButton>
      </ControlGrid>
      <DateFilters baseUrl={baseUrl} />
    </div>
  )
}
