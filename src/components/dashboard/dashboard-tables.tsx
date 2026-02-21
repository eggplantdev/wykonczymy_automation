'use client'

import { useMemo, useState } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { cashRegisterColumns } from '@/lib/tables/cash-registers'
import { userColumns } from '@/lib/tables/users'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { InvestmentDataTable } from '@/components/investments/investment-data-table'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { InvestmentRowT } from '@/lib/tables/investments'
import type { UserRowT } from '@/lib/tables/users'

type CashRegistersTablePropsT = {
  readonly data: readonly CashRegisterRowT[]
}

export function CashRegistersTable({ data }: CashRegistersTablePropsT) {
  const [showOnlyActive, setShowOnlyActive] = useState(true)

  const filteredData = useMemo(
    () => (showOnlyActive ? data.filter((r) => r.active) : data),
    [data, showOnlyActive],
  )

  return (
    <DataTable
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
  readonly investments: readonly InvestmentRowT[]
  readonly users: readonly UserRowT[]
}

export function DashboardTables({ investments, users }: DashboardTablesPropsT) {
  return (
    <div className="mt-8 space-y-8">
      <CollapsibleSection title="Współpracownicy">
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
  const [showOnlyActive, setShowOnlyActive] = useState(true)

  const filteredData = useMemo(
    () => (showOnlyActive ? data.filter((r) => r.active) : data),
    [data, showOnlyActive],
  )

  return (
    <DataTable
      data={filteredData}
      columns={userColumns}
      emptyMessage="Brak współpracowników"
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
