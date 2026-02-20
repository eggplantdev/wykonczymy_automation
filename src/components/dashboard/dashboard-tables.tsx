'use client'

import { DataTable } from '@/components/ui/data-table'
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
  return (
    <DataTable
      data={data}
      columns={cashRegisterColumns}
      emptyMessage="Brak kas"
      getRowHref={(row) => `/kasa/${row.id}`}
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
          <DataTable
            data={users}
            columns={userColumns}
            emptyMessage="Brak współpracowników"
            getRowHref={(row) => `/uzytkownicy/${row.id}`}
          />
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
