'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/tables/data-table/column-toggle'
import { StatusFilter } from '@/components/investments/status-filter'
import { getInvestmentColumns, V1_COLUMN_IDS, V2_COLUMN_IDS } from '@/components/tables/investments'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { GRID_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import type { InvestmentRowT } from '@/types/table-rows'
import { useStatusFilter } from '@/hooks/use-status-filter'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useCurrentUser } from '@/hooks/use-current-user'
import { AddInvestmentDialog } from '@/components/dialogs/add-investment-dialog'
import { Description } from '@/components/ui/description'
import { DropdownMenuCheckboxRow, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import {
  SettlePayoutsDialog,
  type SettleDialogTargetT,
} from '@/components/dialogs/settle-payouts-dialog'
import type { TemplateMetaT } from '@/lib/db/templates'
import { AI_PROGRESS_LABELS, AI_PROGRESS_STEPS } from '@/lib/constants/investment-ai-stage'
import { isClosedStatus } from '@/lib/constants/investment-status'
import { OrderDialog } from '@/components/orders/order-dialog'
import type { OrderSettingsT } from '@/types/order-settings'
import type { ReferenceDataT } from '@/types/reference-data'

const getStatus = (row: InvestmentRowT) => row.status
const getAiProgress = (row: InvestmentRowT) => row.aiProgress
const getSearchableText = (row: InvestmentRowT) =>
  `${row.name} ${row.address} ${row.contactPerson}`

const AI_PROGRESS_OPTIONS = AI_PROGRESS_STEPS.map((step) => ({
  value: step,
  label: AI_PROGRESS_LABELS[step],
}))

const INITIAL_SORTING = [{ id: 'createdAt', desc: true }]

const LAYERS = [
  { label: 'v1', columnIds: V1_COLUMN_IDS },
  { label: 'v2', columnIds: V2_COLUMN_IDS },
]

type InvestmentDataTablePropsT = {
  data: InvestmentRowT[]
  presets: TemplateMetaT[]
  referenceData: ReferenceDataT
  orderSettings: OrderSettingsT
}

export function InvestmentDataTable({
  data,
  presets,
  referenceData,
  orderSettings,
}: InvestmentDataTablePropsT) {
  const { role: userRole } = useCurrentUser()

  const {
    filteredData: statusFiltered,
    selectedStatuses,
    toggleStatus,
    clearStatuses,
  } = useStatusFilter(data, getStatus, 'investments')

  const {
    filteredData: searched,
    searchTerm,
    setSearchTerm,
  } = useSearchFilter(statusFiltered, getSearchableText)

  const {
    filteredData,
    values: aiSteps,
    setValues: setAiSteps,
  } = useClientMultiFilter(searched, getAiProgress)

  const [settleTarget, setSettleTarget] = useState<SettleDialogTargetT | null>(null)
  const [orderTarget, setOrderTarget] = useState<InvestmentRowT | null>(null)
  const columns = getInvestmentColumns({
    userRole,
    onSettle: (investment) =>
      setSettleTarget({ kind: 'investment', id: investment.id, name: investment.name }),
    onOrder: setOrderTarget,
  })

  return (
    <>
      <Description withIcon={false}>
        Widoczne inwestycje {filteredData.length} / {data.length}
      </Description>
      <DataTable
        data={filteredData}
        columns={columns}
        storageKey="investments"
        initialSorting={INITIAL_SORTING}
        getRowHref={(row) => `/inwestycje/${row.id}`}
        getRowClassName={(row) => (isClosedStatus(row.status) ? 'opacity-50' : '')}
        toolbar={({ table, columnVisibility: cv, ...order }) => {
          return (
            <DataTableToolbar
              search={{ value: searchTerm, onChange: setSearchTerm }}
              filters={
                <>
                  <StatusFilter
                    selectedStatuses={selectedStatuses}
                    onToggle={toggleStatus}
                    onClear={clearStatuses}
                    triggerClassName={GRID_FILTER_TRIGGER_CLASS}
                  />
                  <FilterMultiSelect
                    label="Analiza AI"
                    options={AI_PROGRESS_OPTIONS}
                    values={aiSteps}
                    onValuesChange={setAiSteps}
                    icon={Sparkles}
                    triggerClassName={GRID_FILTER_TRIGGER_CLASS}
                  />
                </>
              }
              columns={
                <ColumnToggle
                  table={table}
                  columnVisibility={cv}
                  {...order}
                  sections={
                    <>
                      <DropdownMenuLabel>Warstwy</DropdownMenuLabel>
                      {LAYERS.map(({ label, columnIds }) => (
                        <DropdownMenuCheckboxRow
                          key={label}
                          checked={columnIds.every((id) => cv[id] !== false)}
                          onCheckedChange={(next) =>
                            table.setColumnVisibility((prev) => ({
                              ...prev,
                              ...Object.fromEntries(columnIds.map((id) => [id, next === true])),
                            }))
                          }
                          label={label}
                        />
                      ))}
                    </>
                  }
                />
              }
              actions={<AddInvestmentDialog presets={presets} />}
            />
          )
        }}
      />
      <SettlePayoutsDialog target={settleTarget} onClose={() => setSettleTarget(null)} />
      {orderTarget && (
        <OrderDialog
          investment={{
            id: orderTarget.id,
            street: orderTarget.address,
            postalCode: orderTarget.postalCode,
            city: orderTarget.city,
            siteManagerId: referenceData.investments.find(({ id }) => id === orderTarget.id)
              ?.siteManagerId,
          }}
          referenceData={referenceData}
          orderSettings={orderSettings}
          open
          onOpenChange={(open) => !open && setOrderTarget(null)}
        />
      )}
    </>
  )
}
