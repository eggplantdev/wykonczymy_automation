'use client'

import { DataTable } from '@/components/ui/data-table/data-table'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { cashRegisterColumns } from '@/lib/tables/cash-registers'
import { userColumns } from '@/lib/tables/users'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import { SyncBalancesButton } from '@/components/dashboard/sync-balances-button'
import { useActiveFilter } from '@/hooks/use-active-filter'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { InvestmentRowT } from '@/lib/tables/investments'
import type { UserRowT } from '@/lib/tables/users'

const isCashRegisterActive = (row: CashRegisterRowT) => row.active
const isUserActive = (row: UserRowT) => row.active

type CashRegistersTablePropsT = {
  readonly data: readonly CashRegisterRowT[]
  className?: string
}

function CashRegistersTable({ data, className }: CashRegistersTablePropsT) {
  const { filteredData, showOnlyActive, setShowOnlyActive } = useActiveFilter(
    data,
    isCashRegisterActive,
  )

  return (
    <DataTable
      className={className}
      data={filteredData}
      columns={cashRegisterColumns}
      emptyMessage="Brak kas"
      getRowHref={(row) => `/kasa/${row.id}`}
      getRowClassName={(row) => (!row.active ? 'opacity-50' : '')}
      toolbar={() => (
        <ActiveFilterButton
          isActive={showOnlyActive}
          onChange={setShowOnlyActive}
          activeLabel="Aktywne"
          allLabel="Wszystkie"
        />
      )}
    />
  )
}

type DashboardTablesPropsT = {
  readonly cashRegisters: readonly CashRegisterRowT[]
  readonly investments: readonly InvestmentRowT[]
  readonly users: readonly UserRowT[]
  readonly showSyncButton?: boolean
}

export function DashboardTables({
  cashRegisters,
  investments,
  users,
  showSyncButton,
}: DashboardTablesPropsT) {
  return (
    <div className="mt-8 space-y-8">
      <CollapsibleSection title="Kasy">
        <div className="mt-4 space-y-2">
          <CashRegistersTable data={cashRegisters} />
          {showSyncButton && <SyncBalancesButton className="ml-auto" />}
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Pracownicy">
        <div className="mt-4">
          <UsersTable data={users} />
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Inwestycje">
        <div className="mt-4">
          <InvestmentDataTable data={investments} />
        </div>
      </CollapsibleSection>
    </div>
  )
}

type UsersTablePropsT = {
  readonly data: readonly UserRowT[]
}

function UsersTable({ data }: UsersTablePropsT) {
  const { filteredData, showOnlyActive, setShowOnlyActive } = useActiveFilter(data, isUserActive)

  return (
    <DataTable
      data={filteredData}
      columns={userColumns}
      emptyMessage="Brak pracownikiów"
      getRowHref={(row) => `/uzytkownicy/${row.id}`}
      getRowClassName={(row) => (!row.active ? 'opacity-50' : '')}
      toolbar={() => (
        <ActiveFilterButton
          isActive={showOnlyActive}
          onChange={setShowOnlyActive}
          activeLabel="Aktywni"
          allLabel="Wszyscy"
        />
      )}
    />
  )
}
