'use client'

import type { ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Banknote, Landmark, Tags, User, X } from 'lucide-react'
import { FilterMultiSelect } from '@/components/transfers/filter-multi-select'
import { TRANSFER_TYPES, TRANSFER_TYPE_LABELS } from '@/lib/constants/transfers'
import { MONTHS } from '@/lib/constants/months'
import { getMonthDateRange } from '@/lib/date-utils'
import { buildUrlWithParams } from '@/lib/build-url-with-params'
import { cn } from '@/lib/cn'
import type { ReferenceItemT } from '@/types/reference-data'

type TransferFiltersPropsT = {
  cashRegisters?: ReferenceItemT[]
  investments?: ReferenceItemT[]
  users?: ReferenceItemT[]
  showTypeFilter?: boolean
  baseUrl: string
  className?: string
}

export function TransferFilters({
  cashRegisters,
  investments,
  users,
  showTypeFilter = true,
  baseUrl,
  className,
}: TransferFiltersPropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const getMultiParam = (key: string) => (searchParams.get(key) ?? '').split(',').filter(Boolean)

  const currentTypes = getMultiParam('type')
  const currentSourceRegisters = getMultiParam('sourceRegister')
  const currentInvestments = getMultiParam('investment')
  const currentCreatedBys = getMultiParam('createdBy')
  const currentFrom = searchParams.get('from') ?? ''
  const currentTo = searchParams.get('to') ?? ''

  const now = new Date()
  const pickerMonth = currentFrom ? String(new Date(currentFrom + 'T00:00:00').getMonth() + 1) : ''
  const pickerYear = currentFrom ? String(new Date(currentFrom + 'T00:00:00').getFullYear()) : ''

  function updateParam(key: string, value: string) {
    router.replace(
      buildUrlWithParams(baseUrl, searchParams.toString(), { [key]: value, page: '' }),
      { scroll: false },
    )
  }

  function updateMultipleParams(overrides: Record<string, string>) {
    router.replace(
      buildUrlWithParams(baseUrl, searchParams.toString(), { ...overrides, page: '' }),
      { scroll: false },
    )
  }

  function handleMonthChange(value: string) {
    if (!value) {
      updateMultipleParams({ from: '', to: '' })
      return
    }
    const year = pickerYear ? Number(pickerYear) : now.getFullYear()
    const { from, to } = getMonthDateRange(Number(value), year)
    updateMultipleParams({ from, to })
  }

  function handleYearChange(value: string) {
    if (!value) {
      updateMultipleParams({ from: '', to: '' })
      return
    }
    const month = pickerMonth ? Number(pickerMonth) : now.getMonth() + 1
    const { from, to } = getMonthDateRange(month, Number(value))
    updateMultipleParams({ from, to })
  }

  const currentYear = now.getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const hasEntityFilters =
    currentTypes.length > 0 ||
    currentSourceRegisters.length > 0 ||
    currentInvestments.length > 0 ||
    currentCreatedBys.length > 0
  const hasDateFilters = currentFrom || currentTo

  function clearEntityFilters() {
    updateMultipleParams({ type: '', sourceRegister: '', investment: '', createdBy: '' })
  }

  function clearDateFilters() {
    updateMultipleParams({ from: '', to: '' })
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {(showTypeFilter ||
        (cashRegisters && cashRegisters.length > 0) ||
        (investments && investments.length > 0) ||
        (users && users.length > 0)) && (
        <div className="flex flex-wrap gap-3">
          {showTypeFilter && (
            <FilterMultiSelect
              values={currentTypes}
              onValuesChange={(types) => updateParam('type', types.join(','))}
              options={TRANSFER_TYPES.map((t) => ({
                value: t,
                label: TRANSFER_TYPE_LABELS[t],
              }))}
              label="Typ"
              icon={Tags}
            />
          )}

          {cashRegisters && cashRegisters.length > 0 && (
            <FilterMultiSelect
              values={currentSourceRegisters}
              onValuesChange={(v) => updateParam('sourceRegister', v.join(','))}
              options={cashRegisters.map((cr) => ({ value: String(cr.id), label: cr.name }))}
              label="Kasa"
              icon={Banknote}
            />
          )}

          {investments && investments.length > 0 && (
            <FilterMultiSelect
              values={currentInvestments}
              onValuesChange={(v) => updateParam('investment', v.join(','))}
              options={investments.map((i) => ({ value: String(i.id), label: i.name }))}
              label="Inwestycja"
              icon={Landmark}
            />
          )}

          {users && users.length > 0 && (
            <FilterMultiSelect
              values={currentCreatedBys}
              onValuesChange={(v) => updateParam('createdBy', v.join(','))}
              options={users.map((u) => ({ value: String(u.id), label: u.name }))}
              label="Dodane przez"
              icon={User}
            />
          )}

          <Button
            variant="outline"
            size="sm"
            className="min-w-40 justify-start gap-1.5"
            onClick={clearEntityFilters}
            disabled={!hasEntityFilters}
          >
            <X className="size-4" />
            Wyczyść wszystkie filtry
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Rok">
          <FilterSelect
            value={pickerYear}
            onValueChange={handleYearChange}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
        </FilterField>

        <FilterField label="Miesiąc">
          <FilterSelect
            value={pickerMonth}
            onValueChange={handleMonthChange}
            options={MONTHS.map((label, i) => ({ value: String(i + 1), label }))}
          />
        </FilterField>

        <FilterField label="Od">
          <Input
            type="date"
            value={currentFrom}
            onChange={(e) => updateParam('from', e.target.value)}
            className="w-40"
            placeholder="Od"
          />
        </FilterField>

        <FilterField label="Do">
          <Input
            type="date"
            value={currentTo}
            onChange={(e) => updateParam('to', e.target.value)}
            placeholder="Do"
          />
        </FilterField>

        <Button
          variant="outline"
          size="sm"
          className="min-w-40 justify-start gap-1.5"
          onClick={clearDateFilters}
          disabled={!hasDateFilters}
        >
          <X className="size-4" />
          Wyczyść daty
        </Button>
      </div>
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col space-y-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </div>
  )
}

type FilterOptionT = { value: string; label: string }

type FilterSelectPropsT = {
  value: string
  onValueChange: (value: string) => void
  options: FilterOptionT[]
  showAllOption?: boolean
  className?: string
}

function FilterSelect({ value, onValueChange, options, showAllOption = true }: FilterSelectPropsT) {
  return (
    <Select value={value || 'ALL'} onValueChange={(v) => onValueChange(v === 'ALL' ? '' : v)}>
      <SelectTrigger className={'min-w-40'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {showAllOption && <SelectItem value="ALL">Wszystkie</SelectItem>}
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
