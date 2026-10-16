'use client'

import { useSearchParams } from 'next/navigation'
import {
  Ban,
  Banknote,
  CircleCheck,
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
import { ActiveFilterButton } from '@/components/filters/active-filter-button'
import { ClearButton } from '@/components/filters/clear-button'
import { DateFilters } from '@/components/filters/date-filters'
import { StatButton } from '@/components/ui/stat-button'
import { formatPLN } from '@/lib/utils/format-currency'
import { PAYMENT_METHODS } from '@/lib/constants/transfers'
import { PAYOUT_STATUSES } from '@/lib/constants/payout-confirmation'
import { useTranslation } from '@/hooks/use-translation'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import { useToggleSearchParam } from '@/hooks/use-toggle-search-param'
import { cn } from '@/lib/utils/cn'
import { Loader } from '@/components/ui/loader/loader'
import type { FilterConfigT } from '@/types/filters'

const DEBOUNCE_MS = 600

const ENTITY_FILTER_KEYS = [
  'type',
  'sourceRegister',
  'investment',
  'createdBy',
  'paymentMethod',
  'payoutStatus',
  'otherCategory',
  'expenseCategory',
  'worker',
  'amount',
  'id',
  'cancelledTransactionAudit',
  'showCancelled',
  'workerDrafts',
] as const

type TransferFiltersPropsT = FilterConfigT & {
  baseUrl: string
  className?: string
  totalFilteredAmount?: number
  listsCancelled?: boolean
}

export function TransferFilters({
  cashRegisters,
  investments,
  users,
  workers,
  otherCategories,
  expenseCategories,
  transferTypes,
  showPaymentMethodFilter = false,
  showPayoutStatusFilter = false,
  showCancelledFilter = true,
  showSearchFilters = true,
  showWorkerDraftsFilter = false,
  baseUrl,
  className,
  totalFilteredAmount,
  listsCancelled,
}: TransferFiltersPropsT) {
  const searchParams = useSearchParams()
  const { t } = useTranslation('transfers')
  const { getMultiParam, updateParam, updateMultipleParams, isPending } =
    useUrlFilterParams(baseUrl)

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
  const { isActive: onlyWorkerDrafts, setActive: setOnlyWorkerDrafts } = useToggleSearchParam(
    baseUrl,
    'workerDrafts',
  )
  const revealingCancelled = showCancelled || auditMode

  const cancelledToggles = [
    {
      id: 'cancelledTransactionAudit',
      label: t('onlyCancelled'),
      active: auditMode,
      onToggle: () => setAuditMode(!auditMode),
    },
    {
      id: 'showCancelled',
      label: t('showCancelled'),
      active: revealingCancelled,
      disabled: auditMode,
      onToggle: () => setShowCancelled(!showCancelled),
    },
  ]
  const currentSourceRegisters = getMultiParam('sourceRegister')
  const currentInvestments = getMultiParam('investment')
  const currentCreatedBys = getMultiParam('createdBy')
  const currentWorkers = getMultiParam('worker')
  const currentPaymentMethods = getMultiParam('paymentMethod')
  const currentPayoutStatuses = getMultiParam('payoutStatus')
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
      {((transferTypes && transferTypes.length > 0) ||
        (cashRegisters && cashRegisters.length > 0) ||
        (investments && investments.length > 0) ||
        (users && users.length > 0) ||
        (workers && workers.length > 0) ||
        showPaymentMethodFilter ||
        showPayoutStatusFilter ||
        (otherCategories && otherCategories.length > 0) ||
        (expenseCategories && expenseCategories.length > 0) ||
        showWorkerDraftsFilter) && (
        <ControlGrid>
          {transferTypes && transferTypes.length > 0 && (
            <FilterMultiSelect
              values={currentTypes}
              onValuesChange={(types) => updateParam('type', types.join(','))}
              options={transferTypes.map((type) => ({
                value: type,
                label: t(`type_${type}`),
              }))}
              lockedValues={auditMode ? ['CANCELLATION'] : undefined}
              label={t('filterType')}
              icon={Tags}
              searchable
            />
          )}

          {cashRegisters && cashRegisters.length > 0 && (
            <FilterMultiSelect
              values={currentSourceRegisters}
              onValuesChange={(v) => updateParam('sourceRegister', v.join(','))}
              options={cashRegisters.map((cr) => ({ value: String(cr.id), label: cr.name }))}
              label={t('filterRegister')}
              icon={Banknote}
              searchable
            />
          )}

          {investments && investments.length > 0 && (
            <FilterMultiSelect
              values={currentInvestments}
              onValuesChange={(v) => updateParam('investment', v.join(','))}
              options={investments.map((i) => ({ value: String(i.id), label: i.name }))}
              label={t('filterInvestment')}
              icon={Landmark}
              searchable
            />
          )}

          {users && users.length > 0 && (
            <FilterMultiSelect
              values={currentCreatedBys}
              onValuesChange={(v) => updateParam('createdBy', v.join(','))}
              options={users.map((u) => ({ value: String(u.id), label: u.name }))}
              label={t('filterCreatedBy')}
              icon={User}
              searchable
            />
          )}

          {workers && workers.length > 0 && (
            <FilterMultiSelect
              values={currentWorkers}
              onValuesChange={(v) => updateParam('worker', v.join(','))}
              options={workers.map((w) => ({ value: String(w.id), label: w.name }))}
              label={t('filterWorker')}
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
                label: t(`payment_${m}`),
              }))}
              label={t('filterPaymentMethod')}
              icon={CreditCard}
            />
          )}

          {showPayoutStatusFilter && (
            <FilterMultiSelect
              values={currentPayoutStatuses}
              onValuesChange={(v) => updateParam('payoutStatus', v.join(','))}
              options={PAYOUT_STATUSES.map((status) => ({
                value: status,
                label: t(`payoutStatus_${status}`),
              }))}
              label={t('filterPayoutStatus')}
              icon={CircleCheck}
            />
          )}

          {otherCategories && otherCategories.length > 0 && (
            <FilterMultiSelect
              values={currentOtherCategories}
              onValuesChange={(v) => updateParam('otherCategory', v.join(','))}
              options={otherCategories.map((c) => ({ value: String(c.id), label: c.name }))}
              label={t('filterCategory')}
              icon={FolderOpen}
              searchable
            />
          )}

          {expenseCategories && expenseCategories.length > 0 && (
            <FilterMultiSelect
              values={currentExpenseCategories}
              onValuesChange={(v) => updateParam('expenseCategory', v.join(','))}
              options={expenseCategories.map((c) => ({ value: String(c.id), label: c.name }))}
              label={t('filterExpenseCategory')}
              icon={Receipt}
              searchable
            />
          )}

          {showWorkerDraftsFilter && (
            <ActiveFilterButton
              isActive={onlyWorkerDrafts}
              onChange={setOnlyWorkerDrafts}
              activeLabel={t('filterWorkerDrafts')}
            />
          )}
        </ControlGrid>
      )}

      <ControlGrid>
        {showSearchFilters && (
          <>
            <SearchFilterInput
              value={currentAmount}
              onChange={(v) => updateParam('amount', v)}
              placeholder={t('searchAmount')}
              inputMode="decimal"
              className={SEARCH_FILTER_TOOLBAR_WIDTH}
              debounceMs={DEBOUNCE_MS}
            />

            <SearchFilterInput
              value={currentId}
              onChange={(v) => updateParam('id', stripNonDigits(v))}
              placeholder={t('searchId')}
              inputMode="numeric"
              className={SEARCH_FILTER_TOOLBAR_WIDTH}
              debounceMs={DEBOUNCE_MS}
            />
          </>
        )}

        {showCancelledFilter && (
          <FilterMultiSelect label={t('filterCancelled')} icon={Ban} toggles={cancelledToggles} />
        )}

        <ClearButton onClick={clearEntityFilters} disabled={!hasEntityFilters}>
          {t('clearFilters')}
        </ClearButton>
      </ControlGrid>
      <DateFilters baseUrl={baseUrl} />

      {totalFilteredAmount !== undefined && hasAnyFilter && (
        <StatButton
          label={t('filteredSum')}
          value={formatPLN(totalFilteredAmount)}
          className="border-chart-blue"
          tooltip={listsCancelled ? t('filteredSumTip') : undefined}
        />
      )}
    </div>
  )
}

function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '')
}
