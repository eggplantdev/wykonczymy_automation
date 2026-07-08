'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Banknote, CreditCard, FolderOpen, Landmark, Receipt, Tags, User } from 'lucide-react'
import { FilterGrid } from '@/components/ui/filter-grid'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { FilterMultiSelect } from '@/components/transfers/filter-multi-select'
import { ClearButton } from '@/components/transfers/clear-button'
import { DateFilters } from '@/components/transfers/date-filters'
import { StatButton } from '@/components/ui/stat-button'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/constants/transfers'
import { buildUrlWithParams } from '@/lib/utils/build-url-with-params'
import { cn } from '@/lib/utils/cn'
import { Loader } from '@/components/ui/loader/loader'
import type { ReferenceItemT } from '@/types/reference-data'

const DEBOUNCE_MS = 600

const ENTITY_FILTER_KEYS = [
  'type',
  'sourceRegister',
  'investment',
  'createdBy',
  'paymentMethod',
  'otherCategory',
  'expenseCategory',
  'amount',
  'id',
] as const

type TransferFiltersPropsT = {
  cashRegisters?: ReferenceItemT[]
  investments?: ReferenceItemT[]
  users?: ReferenceItemT[]
  otherCategories?: ReferenceItemT[]
  expenseCategories?: ReferenceItemT[]
  showTypeFilter?: boolean
  showPaymentMethodFilter?: boolean
  baseUrl: string
  className?: string
  totalFilteredAmount?: number
}

export function TransferFilters({
  cashRegisters,
  investments,
  users,
  otherCategories,
  expenseCategories,
  showTypeFilter = true,
  showPaymentMethodFilter = false,
  baseUrl,
  className,
  totalFilteredAmount,
}: TransferFiltersPropsT) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Transition keeps UI responsive during server re-render (shows Loader instead of blocking).
  // Debounce in FilterMultiSelect batches rapid clicks to reduce how often we hit the server.
  const [isPending, startTransition] = useTransition()

  function navigate(url: string) {
    startTransition(() => {
      router.replace(url, { scroll: false })
    })
  }

  function updateParam(key: string, value: string) {
    navigate(buildUrlWithParams(baseUrl, searchParams.toString(), { [key]: value, page: '' }))
  }

  function updateMultipleParams(overrides: Record<string, string>) {
    navigate(buildUrlWithParams(baseUrl, searchParams.toString(), { ...overrides, page: '' }))
  }

  const getMultiParam = (key: string) => (searchParams.get(key) ?? '').split(',').filter(Boolean)

  const currentAmount = searchParams.get('amount') ?? ''
  const currentId = searchParams.get('id') ?? ''
  const currentTypes = getMultiParam('type')
  const currentSourceRegisters = getMultiParam('sourceRegister')
  const currentInvestments = getMultiParam('investment')
  const currentCreatedBys = getMultiParam('createdBy')
  const currentPaymentMethods = getMultiParam('paymentMethod')
  const currentOtherCategories = getMultiParam('otherCategory')
  const currentExpenseCategories = getMultiParam('expenseCategory')

  const hasEntityFilters = ENTITY_FILTER_KEYS.some((k) => getMultiParam(k).length > 0)
  const hasDateFilter = !!searchParams.get('from') || !!searchParams.get('to')
  const hasAnyFilter = hasEntityFilters || hasDateFilter

  function clearEntityFilters() {
    updateMultipleParams(Object.fromEntries(ENTITY_FILTER_KEYS.map((k) => [k, ''])))
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Loader loading={isPending} portal />
      {(showTypeFilter ||
        (cashRegisters && cashRegisters.length > 0) ||
        (investments && investments.length > 0) ||
        (users && users.length > 0) ||
        showPaymentMethodFilter ||
        (otherCategories && otherCategories.length > 0) ||
        (expenseCategories && expenseCategories.length > 0)) && (
        <FilterGrid>
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
              label="Kasa źródłowa"
              icon={Banknote}
              searchable
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
              searchable
            />
          )}

          {expenseCategories && expenseCategories.length > 0 && (
            <FilterMultiSelect
              values={currentExpenseCategories}
              onValuesChange={(v) => updateParam('expenseCategory', v.join(','))}
              options={expenseCategories.map((c) => ({ value: String(c.id), label: c.name }))}
              label="Typ wydatku inwestycyjnego"
              icon={Receipt}
              searchable
            />
          )}

          <SearchFilterInput
            value={currentAmount}
            onChange={(v) => updateParam('amount', v)}
            placeholder="Kwota"
            inputMode="decimal"
            inputClassName="w-36 lg:w-36"
            debounceMs={DEBOUNCE_MS}
          />

          <SearchFilterInput
            value={currentId}
            onChange={(v) => updateParam('id', stripNonDigits(v))}
            placeholder="ID"
            inputMode="numeric"
            inputClassName="w-24 lg:w-28"
            debounceMs={DEBOUNCE_MS}
          />

          <ClearButton onClick={clearEntityFilters} disabled={!hasEntityFilters}>
            Wyczyść filtry
          </ClearButton>
        </FilterGrid>
      )}
      <DateFilters updateParam={updateParam} updateMultipleParams={updateMultipleParams} />

      {totalFilteredAmount !== undefined && hasAnyFilter && (
        <StatButton
          label="Suma wybranych transakcji"
          value={formatPLN(totalFilteredAmount)}
          className="border-chart-blue"
        />
      )}
    </div>
  )
}

// Drops any character that isn't 0–9 (e.g. user paste with spaces, commas, "#" prefix).
// Keeps the ID input safe to pass as a numeric URL param without further validation.
function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '')
}
