'use client'

import { useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Banknote,
  Calendar,
  CreditCard,
  FolderOpen,
  Landmark,
  Tags,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { FilterMultiSelect } from '@/components/transfers/filter-multi-select'
import {
  TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/constants/transfers'
import { MONTHS } from '@/lib/constants/months'
import { getMonthDateRange } from '@/lib/date-utils'
import { buildUrlWithParams } from '@/lib/build-url-with-params'
import { cn } from '@/lib/cn'
import type { ReferenceItemT } from '@/types/reference-data'

type TransferFiltersPropsT = {
  cashRegisters?: ReferenceItemT[]
  investments?: ReferenceItemT[]
  users?: ReferenceItemT[]
  workers?: ReferenceItemT[]
  otherCategories?: ReferenceItemT[]
  showTypeFilter?: boolean
  showPaymentMethodFilter?: boolean
  baseUrl: string
  className?: string
}

export function TransferFilters({
  cashRegisters,
  investments,
  users,
  workers,
  otherCategories,
  showTypeFilter = true,
  showPaymentMethodFilter = false,
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
  const currentWorkers = getMultiParam('worker')
  const currentPaymentMethods = getMultiParam('paymentMethod')
  const currentOtherCategories = getMultiParam('otherCategory')
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
    currentCreatedBys.length > 0 ||
    currentWorkers.length > 0 ||
    currentPaymentMethods.length > 0 ||
    currentOtherCategories.length > 0
  const hasDateFilters = currentFrom || currentTo

  function clearEntityFilters() {
    updateMultipleParams({
      type: '',
      sourceRegister: '',
      investment: '',
      createdBy: '',
      worker: '',
      paymentMethod: '',
      otherCategory: '',
    })
  }

  function clearDateFilters() {
    updateMultipleParams({ from: '', to: '' })
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {(showTypeFilter ||
        (cashRegisters && cashRegisters.length > 0) ||
        (investments && investments.length > 0) ||
        (users && users.length > 0) ||
        (workers && workers.length > 0) ||
        showPaymentMethodFilter ||
        (otherCategories && otherCategories.length > 0)) && (
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
              searchable
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

          {workers && workers.length > 0 && (
            <FilterMultiSelect
              values={currentWorkers}
              onValuesChange={(v) => updateParam('worker', v.join(','))}
              options={workers.map((w) => ({ value: String(w.id), label: w.name }))}
              label="Pracownik"
              icon={Users}
              searchable
            />
          )}

          {showPaymentMethodFilter && (
            <FilterMultiSelect
              values={currentPaymentMethods}
              onValuesChange={(v) => updateParam('paymentMethod', v.join(','))}
              options={PAYMENT_METHODS.map((m) => ({
                value: m,
                label: PAYMENT_METHOD_LABELS[m],
              }))}
              label="Metoda płatności"
              icon={CreditCard}
            />
          )}

          {otherCategories && otherCategories.length > 0 && (
            <FilterMultiSelect
              values={currentOtherCategories}
              onValuesChange={(v) => updateParam('otherCategory', v.join(','))}
              options={otherCategories.map((c) => ({ value: String(c.id), label: c.name }))}
              label="Kategoria"
              icon={FolderOpen}
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
      <div className="flex flex-wrap items-center gap-3">
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

type FilterOptionT = { value: string; label: string }

type FilterSelectPropsT = {
  value: string
  onValueChange: (value: string) => void
  options: FilterOptionT[]
  placeholder?: string
  icon?: LucideIcon
  showAllOption?: boolean
}

function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Wszystkie',
  icon: Icon,
  showAllOption = true,
}: FilterSelectPropsT) {
  return (
    <Select value={value || 'ALL'} onValueChange={(v) => onValueChange(v === 'ALL' ? '' : v)}>
      <SelectTrigger
        className={cn('h-8 w-fit min-w-40 text-sm', (!value || value === 'ALL') && 'opacity-40')}
      >
        {Icon && <Icon className="text-muted-foreground size-4" />}
        <SelectValue placeholder={placeholder} />
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

function DateFilterButton({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('w-fit min-w-40 justify-start gap-1.5', !value && 'opacity-40')}
      onClick={() => inputRef.current?.showPicker()}
    >
      <Calendar className="size-4" />
      {value || label}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
    </Button>
  )
}
