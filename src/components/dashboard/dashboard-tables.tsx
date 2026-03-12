'use client'

import { useMemo } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { FilterMultiSelect } from '@/components/transfers/filter-multi-select'
import { Tags, User } from 'lucide-react'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { getCashRegisterColumns, REGISTER_TYPE_LABELS } from '@/lib/tables/cash-registers'
import { formatPLN } from '@/lib/format-currency'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Description } from '@/components/ui/description'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { RegisterBalanceChart } from '@/components/dashboard/register-balance-chart'
import { ToggleStatButtons } from '@/components/ui/toggle-stat-buttons'
import { SECTION_IDS } from '@/lib/constants/sections'
import { useActiveFilter } from '@/hooks/use-active-filter'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useOptimisticToggle } from '@/hooks/use-optimistic-toggle'
import { toggleCashRegisterActive } from '@/lib/actions/toggle-active'
import type { StatEntryT } from '@/components/ui/toggle-stat-buttons'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { CashRegisterTypeT } from '@/types/reference-data'
import type { InvestmentRowT } from '@/lib/tables/investments'

const USER_REGISTER_COLOR = 'var(--color-chart-turquoise)'

const isCashRegisterActive = (row: CashRegisterRowT) => row.active
const getActiveUpdate = (newActive: boolean) => ({ active: newActive })
const getType = (row: CashRegisterRowT) => row.type
const getOwner = (row: CashRegisterRowT) => row.ownerName
const getCashRegisterSearchText = (row: CashRegisterRowT) => `${row.name} ${row.ownerName}`

type CashRegistersTablePropsT = {
  readonly data: readonly CashRegisterRowT[]
  className?: string
}

const TYPE_OPTIONS = (Object.keys(REGISTER_TYPE_LABELS) as CashRegisterTypeT[]).map((value) => ({
  value,
  label: REGISTER_TYPE_LABELS[value],
}))

function CashRegistersTable({ data, className }: CashRegistersTablePropsT) {
  const { optimisticData, handleToggle } = useOptimisticToggle(
    data,
    getActiveUpdate,
    toggleCashRegisterActive,
  )

  const {
    filteredData: activeFiltered,
    showOnlyActive,
    setShowOnlyActive,
  } = useActiveFilter(optimisticData, isCashRegisterActive)

  const ownerOptions = useMemo(() => {
    const uniqueOwners = [...new Set(optimisticData.map((r) => r.ownerName))].filter(Boolean).sort()
    return uniqueOwners.map((name) => ({ value: name, label: name }))
  }, [optimisticData])

  const {
    filteredData: typeFiltered,
    values: typeValues,
    setValues: setTypeValues,
  } = useClientMultiFilter(activeFiltered, getType)

  const {
    filteredData: ownerFiltered,
    values: ownerValues,
    setValues: setOwnerValues,
  } = useClientMultiFilter(typeFiltered, getOwner)
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    ownerFiltered,
    getCashRegisterSearchText,
  )

  const columns = useMemo(() => getCashRegisterColumns(handleToggle), [handleToggle])

  return (
    <>
      <RegisterBalanceChart data={filteredData} />
      <DataTable
        className={className}
        data={filteredData}
        columns={columns}
        storageKey="cashRegisters"
        getRowHref={(row) => `/kasa/${row.id}`}
        getRowClassName={(row) => (!row.active ? 'opacity-50' : '')}
        toolbar={(table, cv) => (
          <>
            <SearchFilterInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Szukaj..."
            />
            <FilterMultiSelect
              label="Typ"
              options={TYPE_OPTIONS}
              values={typeValues}
              onValuesChange={setTypeValues}
              icon={Tags}
            />
            <FilterMultiSelect
              label="Właściciel"
              options={ownerOptions}
              values={ownerValues}
              onValuesChange={setOwnerValues}
              icon={User}
              searchable
            />
            <ActiveFilterButton
              isActive={showOnlyActive}
              onChange={setShowOnlyActive}
              activeLabel="Aktywne"
              allLabel="Wszystkie"
            />
            <ColumnToggle table={table} columnVisibility={cv} />
          </>
        )}
      />
    </>
  )
}

type DashboardTablesPropsT = {
  readonly cashRegisters: readonly CashRegisterRowT[]
  readonly investments: readonly InvestmentRowT[]
  readonly currentUserName: string
}

export function DashboardTables({
  cashRegisters,
  investments,
  currentUserName,
}: DashboardTablesPropsT) {
  const activeInvestmentCount = useMemo(
    () => investments.filter((i) => i.status === 'active').length,
    [investments],
  )

  const userEntries: StatEntryT[] = useMemo(() => {
    return cashRegisters
      .filter((cr) => cr.ownerName === currentUserName)
      .map((cr) => ({
        label: cr.name,
        value: formatPLN(cr.balance),
        amount: cr.balance,
        borderColor: USER_REGISTER_COLOR,
        valueClassName:
          cr.balance > 0 ? 'text-chart-green' : cr.balance < 0 ? 'text-destructive' : undefined,
      }))
  }, [cashRegisters, currentUserName])

  return (
    <div className="mt-8 space-y-8">
      {userEntries.length > 0 && (
        <ToggleStatButtons
          rows={[userEntries]}
          summaryLabel="Saldo moich kas"
          rowLabels={['Moje Kasy']}
        />
      )}
      <CollapsibleSection title="Kasy" id={SECTION_IDS.cashRegisters}>
        <div className="mt-4">
          <CashRegistersTable data={cashRegisters} />
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Inwestycje" id={SECTION_IDS.investments}>
        <Description>{activeInvestmentCount} aktywnych</Description>
        <div className="mt-4">
          <InvestmentDataTable data={investments} />
        </div>
      </CollapsibleSection>
    </div>
  )
}
