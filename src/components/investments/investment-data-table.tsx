'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { Button } from '@/components/ui/button'
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
          <Button
            variant="outline"
            size="sm"
            className={
              showOnlyActive
                ? 'border-green-600 text-green-600 hover:bg-green-600 hover:text-white'
                : undefined
            }
            onClick={() => setShowOnlyActive((prev) => !prev)}
          >
            {showOnlyActive && <Check className="size-3.5" />}
            {showOnlyActive ? 'Aktywne' : 'Wszystkie'}
          </Button>
          <ColumnToggle table={table} />
        </>
      )}
    />
  )
}
