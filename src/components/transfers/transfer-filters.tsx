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
import { TRANSFER_TYPES, TRANSFER_TYPE_LABELS } from '@/lib/constants/transfers'
import { MONTHS } from '@/lib/constants/months'
import { getMonthDateRange } from '@/lib/helpers'
import { buildUrlWithParams } from '@/lib/helpers'
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

  const currentType = searchParams.get('type') ?? ''
  const currentCashRegister = searchParams.get('cashRegister') ?? ''
  const currentInvestment = searchParams.get('investment') ?? ''
  const currentCreatedBy = searchParams.get('createdBy') ?? ''
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
    currentType || currentCashRegister || currentInvestment || currentCreatedBy
  const hasDateFilters = currentFrom || currentTo

  function clearEntityFilters() {
    updateMultipleParams({ type: '', cashRegister: '', investment: '', createdBy: '' })
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
            <FilterField label="Typ">
              <FilterSelect
                value={currentType}
                onValueChange={(v) => updateParam('type', v)}
                options={TRANSFER_TYPES.map((t) => ({
                  value: t,
                  label: TRANSFER_TYPE_LABELS[t],
                }))}
              />
            </FilterField>
          )}

          {cashRegisters && cashRegisters.length > 0 && (
            <FilterField label="Kasa">
              <FilterSelect
                value={currentCashRegister}
                onValueChange={(v) => updateParam('cashRegister', v)}
                options={cashRegisters.map((cr) => ({ value: String(cr.id), label: cr.name }))}
              />
            </FilterField>
          )}

          {investments && investments.length > 0 && (
            <FilterField label="Inwestycja">
              <FilterSelect
                value={currentInvestment}
                onValueChange={(v) => updateParam('investment', v)}
                options={investments.map((i) => ({ value: String(i.id), label: i.name }))}
              />
            </FilterField>
          )}

          {users && users.length > 0 && (
            <FilterField label="Dodane przez">
              <FilterSelect
                value={currentCreatedBy}
                onValueChange={(v) => updateParam('createdBy', v)}
                options={users.map((u) => ({ value: String(u.id), label: u.name }))}
              />
            </FilterField>
          )}

          {hasEntityFilters && (
            <Button variant="ghost" size="sm" className="self-end" onClick={clearEntityFilters}>
              Wyczyść filtry
            </Button>
          )}
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

        {hasDateFilters && (
          <Button variant="ghost" size="sm" className="self-end" onClick={clearDateFilters}>
            Wyczyść daty
          </Button>
        )}
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
    <Select value={value} onValueChange={(v) => onValueChange(v === 'ALL' ? '' : v)}>
      <SelectTrigger className={'min-w-40'}>
        <SelectValue placeholder="Wszystkie" />
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
