'use client'

import { useSearchParams } from 'next/navigation'
import {
  Ban,
  Banknote,
  CreditCard,
  FolderOpen,
  HardHat,
  Landmark,
  Receipt,
  Tags,
  User,
} from 'lucide-react'
import { ControlGrid } from '@/components/ui/control-grid'
import {
  SearchFilterInput,
  SEARCH_FILTER_TOOLBAR_WIDTH,
} from '@/components/filters/search-filter-input'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { ClearButton } from '@/components/filters/clear-button'
import { DateFilters } from '@/components/filters/date-filters'
import { StatButton } from '@/components/ui/stat-button'
import { formatPLN } from '@/lib/utils/format-currency'
import {
  TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/constants/transfers'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import { useToggleSearchParam } from '@/hooks/use-toggle-search-param'
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
  'worker',
  'amount',
  'id',
  // Narrows the list like the entity filters above, so „Wyczyść filtry" must reach it too —
  // omitting it left a cleared panel still scoped to anulowania.
  'cancelledTransactionAudit',
  // Revealing anulowane IS a departure from the default view, so it counts and clears as a filter.
  'showCancelled',
] as const

type TransferFiltersPropsT = {
  cashRegisters?: ReferenceItemT[]
  investments?: ReferenceItemT[]
  users?: ReferenceItemT[]
  workers?: ReferenceItemT[]
  otherCategories?: ReferenceItemT[]
  expenseCategories?: ReferenceItemT[]
  showTypeFilter?: boolean
  showPaymentMethodFilter?: boolean
  baseUrl: string
  className?: string
  totalFilteredAmount?: number
  /** Server-derived (see TransferTableServer) — the list shows cancelled rows, the sum never does. */
  listsCancelled?: boolean
}

export function TransferFilters({
  cashRegisters,
  investments,
  users,
  workers,
  otherCategories,
  expenseCategories,
  showTypeFilter = true,
  showPaymentMethodFilter = false,
  baseUrl,
  className,
  totalFilteredAmount,
  listsCancelled,
}: TransferFiltersPropsT) {
  const searchParams = useSearchParams()
  // Debounce in FilterMultiSelect batches rapid clicks to reduce how often we hit the server.
  const { updateParam, updateMultipleParams, isPending } = useUrlFilterParams(baseUrl)

  const getMultiParam = (key: string) => (searchParams.get(key) ?? '').split(',').filter(Boolean)

  const currentAmount = searchParams.get('amount') ?? ''
  const currentId = searchParams.get('id') ?? ''
  const currentTypes = getMultiParam('type')
  const { isActive: auditMode, setActive: setAuditMode } = useToggleSearchParam(
    baseUrl,
    'cancelledTransactionAudit',
  )
  const { isActive: showCancelled, setActive: setShowCancelled } = useToggleSearchParam(
    baseUrl,
    'showCancelled',
  )
  // Named as what the user turns ON, not the default they start in — hiding anulowane is the resting
  // state, so „Ukryj anulowane" would read ticked before any filter was set. Always on in audit mode.
  const revealingCancelled = showCancelled || auditMode

  const cancelledToggles = [
    {
      id: 'cancelledTransactionAudit',
      label: 'Tylko anulowane transakcje',
      active: auditMode,
      onToggle: () => setAuditMode(!auditMode),
    },
    {
      id: 'showCancelled',
      label: 'Pokaż anulowane',
      active: revealingCancelled,
      // Audit mode already pins anulowane on (`lib/queries/transfer-filters.ts`); disabled rather than
      // dropped, since a row that vanishes takes the reason with it.
      disabled: auditMode,
      onToggle: () => setShowCancelled(!showCancelled),
    },
  ]
  const currentSourceRegisters = getMultiParam('sourceRegister')
  const currentInvestments = getMultiParam('investment')
  const currentCreatedBys = getMultiParam('createdBy')
  const currentWorkers = getMultiParam('worker')
  const currentPaymentMethods = getMultiParam('paymentMethod')
  const currentOtherCategories = getMultiParam('otherCategory')
  const currentExpenseCategories = getMultiParam('expenseCategory')

  // Only revealing anulowane counts as a filter — they're hidden by default, so counting that too
  // would report a filter to someone who set none.
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
        (workers && workers.length > 0) ||
        showPaymentMethodFilter ||
        (otherCategories && otherCategories.length > 0) ||
        (expenseCategories && expenseCategories.length > 0)) && (
        <ControlGrid>
          {showTypeFilter && (
            <FilterMultiSelect
              values={currentTypes}
              onValuesChange={(types) => updateParam('type', types.join(','))}
              options={TRANSFER_TYPES.map((t) => ({
                value: t,
                label: TRANSFER_TYPE_LABELS[t],
              }))}
              // In „Tryb anulowań" every row is an anulowanie (`lib/queries/transfer-filters.ts`), so
              // „Anulowanie" is locked on rather than offered as a choice that would do nothing.
              lockedValues={auditMode ? ['CANCELLATION'] : undefined}
              label="Typ"
              icon={Tags}
              searchable
            />
          )}

          {cashRegisters && cashRegisters.length > 0 && (
            <FilterMultiSelect
              values={currentSourceRegisters}
              onValuesChange={(v) => updateParam('sourceRegister', v.join(','))}
              options={cashRegisters.map((cr) => ({ value: String(cr.id), label: cr.name }))}
              label="Kasa"
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

          {workers && workers.length > 0 && (
            <FilterMultiSelect
              values={currentWorkers}
              onValuesChange={(v) => updateParam('worker', v.join(','))}
              options={workers.map((w) => ({ value: String(w.id), label: w.name }))}
              label="Pracownik"
              icon={HardHat}
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
        </ControlGrid>
      )}

      {/* Own row, not the tail of the select row: typed search fields wrapped wherever the selects
          happened to stop on a narrow screen. Outside the guard above too — search works with no
          entity filters present. */}
      <ControlGrid>
        <SearchFilterInput
          value={currentAmount}
          onChange={(v) => updateParam('amount', v)}
          placeholder="Szukaj po kwocie"
          inputMode="decimal"
          className={SEARCH_FILTER_TOOLBAR_WIDTH}
          debounceMs={DEBOUNCE_MS}
        />

        <SearchFilterInput
          value={currentId}
          onChange={(v) => updateParam('id', stripNonDigits(v))}
          placeholder="Szukaj po id"
          inputMode="numeric"
          className={SEARCH_FILTER_TOOLBAR_WIDTH}
          debounceMs={DEBOUNCE_MS}
        />

        <FilterMultiSelect label="Anulowane" icon={Ban} toggles={cancelledToggles} />

        <ClearButton onClick={clearEntityFilters} disabled={!hasEntityFilters}>
          Wyczyść filtry
        </ClearButton>
      </ControlGrid>
      <DateFilters baseUrl={baseUrl} />

      {totalFilteredAmount !== undefined && hasAnyFilter && (
        <StatButton
          label="Suma wybranych transakcji"
          value={formatPLN(totalFilteredAmount)}
          className="border-chart-blue"
          tooltip={
            listsCancelled
              ? 'Suma pomija transakcje anulowane, ale liczy anulowania, które je cofają — dlatego nie zgadza się z listą poniżej.'
              : undefined
          }
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
