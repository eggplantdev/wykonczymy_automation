'use client'

import { useMemo, useState } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { investmentColumns, type InvestmentRowT } from '@/lib/tables/investments'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type StatusFilterT = 'all' | 'active' | 'completed'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'active', label: 'Aktywne' },
  { value: 'completed', label: 'Zakończone' },
] as const

type InvestmentDataTablePropsT = {
  readonly data: readonly InvestmentRowT[]
}

export function InvestmentDataTable({ data }: InvestmentDataTablePropsT) {
  const [statusFilter, setStatusFilter] = useState<StatusFilterT>('active')

  const filteredData = useMemo(
    () => (statusFilter === 'all' ? data : data.filter((row) => row.status === statusFilter)),
    [data, statusFilter],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex flex-col space-y-1">
          <span className="text-muted-foreground text-xs font-medium">Status</span>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilterT)}>
            <SelectTrigger className="min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DataTable
        data={filteredData}
        columns={investmentColumns}
        emptyMessage="Brak inwestycji"
        storageKey="investments"
        getRowHref={(row) => `/inwestycje/${row.id}`}
        toolbar={(table) => <ColumnToggle table={table} />}
      />
    </div>
  )
}
