'use client'

import { MaterialsBreakdownTable } from '@/components/kosztorys/summary/tables/materials-breakdown-table'
import { MaterialsTransactionsTable } from '@/components/kosztorys/summary/tables/materials-transactions-table'
import { InlineModeSelect } from '@/components/ui/inline-mode-select'
import {
  PRICING_MODE_DESCRIPTIONS,
  PRICING_MODE_OPTIONS,
} from '@/components/kosztorys/summary/model/materials-pricing-options'
import { materialsNetRateForMode, pricingModeOf } from '@/lib/kosztorys/materials-pricing-mode'
import { clientVisibleExpenseRows } from '@/lib/kosztorys/expense-datasets'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Description } from '@/components/ui/description'
import { DecimalField } from '@/components/ui/decimal-field'
import { SETTLED_TYPE } from '@/lib/constants/transfers'
import { ratePercent } from '@/lib/kosztorys/format'
import type { MaterialsBreakdownRowT } from '@/types/investment-financials'
import type { MaterialTransactionRowT } from '@/types/transfers'

type PropsT = {
  investmentId: number
  investmentName: string
  materialsBreakdown: MaterialsBreakdownRowT[]
  settledBreakdown?: MaterialsBreakdownRowT[]
  materialTransactions: MaterialTransactionRowT[]
  materialsNetRate: number | null
  vatRate: number
  onMaterialsNetRateChange?: (rate: number | null) => void
  isSavingSettings?: boolean
  pricingLockedReason?: string
  preview?: boolean
  showTransactions?: boolean
}

export function SummaryExpensesTab({
  investmentId,
  investmentName,
  materialsBreakdown,
  settledBreakdown = [],
  materialTransactions,
  materialsNetRate,
  vatRate,
  onMaterialsNetRateChange,
  isSavingSettings = false,
  pricingLockedReason,
  preview = false,
  showTransactions = true,
}: PropsT) {
  const pricingMode = pricingModeOf(materialsNetRate)
  // an investment whose only wydatki are settled must not open a „Lista wydatków"
  // that a client then finds empty.
  const listedTransactions = preview
    ? clientVisibleExpenseRows(materialTransactions)
    : materialTransactions
  // The investment page's panel never supplies `materialTransactions`, so a row-sourced gate would
  // blank the breakdown on a host whose figures are fully populated.
  const hasBilledMaterials = materialsBreakdown.length > 0
  const isEmpty =
    !hasBilledMaterials &&
    settledBreakdown.length === 0 &&
    !(showTransactions && listedTransactions.length > 0)

  return (
    <div className="flex w-full flex-col gap-4">
      {onMaterialsNetRateChange && (
        <div className="flex flex-col items-start gap-2">
          <InlineModeSelect
            label="Sposób rozliczenia materiałów"
            value={pricingMode}
            onValueChange={(next) =>
              onMaterialsNetRateChange(materialsNetRateForMode(next, vatRate))
            }
            options={PRICING_MODE_OPTIONS}
            description={PRICING_MODE_DESCRIPTIONS[pricingMode]}
            disabled={isSavingSettings}
            lockedReason={pricingLockedReason}
          />
          {pricingMode === 'net' && (
            <DecimalField
              label="Stawka vat na materiały"
              suffix="%"
              withSave
              value={ratePercent(materialsNetRate ?? vatRate)}
              disabled={isSavingSettings}
              min={0}
              max={100}
              onCommit={(percent) => onMaterialsNetRateChange(percent / 100)}
            />
          )}
        </div>
      )}
      {isEmpty && (
        <Description withIcon={false}>Brak wydatków inwestycyjnych na materiały.</Description>
      )}
      <div className="flex flex-col gap-6">
        {hasBilledMaterials && (
          <MaterialsBreakdownTable
            rows={materialsBreakdown}
            netRate={materialsNetRate}
            byCategory={preview}
          />
        )}
        {settledBreakdown.length > 0 && (
          <MaterialsBreakdownTable
            rows={settledBreakdown}
            caption={SETTLED_TYPE.label}
            netRate={null}
          />
        )}
      </div>
      {showTransactions && listedTransactions.length > 0 && (
        <CollapsibleSection title="Lista wydatków" size="sm">
          <div className="pt-4">
            <MaterialsTransactionsTable
              investmentId={investmentId}
              investmentName={investmentName}
              rows={listedTransactions}
              preview={preview}
            />
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}
