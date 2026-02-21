'use client'

import { useMemo, useState } from 'react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { ActiveFilterButton } from '@/components/ui/active-filter-button'
import { investmentColumns, type InvestmentRowT } from '@/lib/tables/investments'

type InvestmentDataTablePropsT = {
  readonly data: readonly InvestmentRowT[]
}

export function InvestmentDataTable({ data }: InvestmentDataTablePropsT) {
  const [showOnlyActive, setShowOnlyActive] = useState(true)

  const filteredData = useMemo(
    () => (showOnlyActive ? data.filter((row) => row.status === 'active') : data),
    [data, showOnlyActive],
  )

  return (
    <DataTable
      data={filteredData}
      columns={investmentColumns}
      emptyMessage="Brak inwestycji"
      storageKey="investments"
      getRowHref={(row) => `/inwestycje/${row.id}`}
      getRowClassName={(row) => (row.status === 'completed' ? 'opacity-50' : '')}
      toolbar={(table) => (
        <>
          <ActiveFilterButton
            isActive={showOnlyActive}
            onChange={setShowOnlyActive}
            activeLabel="Aktywne"
            allLabel="Wszystkie"
          />
          <ColumnToggle table={table} />
        </>
      )}
    />
  )
}
