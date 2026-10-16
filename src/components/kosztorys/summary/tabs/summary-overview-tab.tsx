'use client'

import type { PriceViewT } from '@/lib/kosztorys/calc'
import { settlementModeToMoneyAxis, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import {
  billedMaterials,
  faceValue,
  laborCostsNetPreDiscount,
  type MaterialsT,
  type MoneyPairT,
} from '@/lib/kosztorys/summary-economics'
import { SettlementSummary } from '@/components/kosztorys/summary/blocks/settlement-summary'
import { InlineModeSelect } from '@/components/ui/inline-mode-select'
import {
  SETTLEMENT_MODE_DESCRIPTIONS,
  SETTLEMENT_MODE_SELECT_OPTIONS,
} from '@/components/kosztorys/summary/model/settlement-mode-options'
import { buildSettlementGroups } from '@/components/kosztorys/summary/model/settlement-groups'
import { SettlementPlaneWarning } from '@/components/kosztorys/summary/blocks/settlement-plane-warning'
import { offPlaneDeposits } from '@/lib/kosztorys/off-plane-deposits'
import { SummaryDepositsTab } from '@/components/kosztorys/summary/tabs/summary-deposits-tab'
import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { Separator } from '@/components/ui/separator'
import { SlicePie } from '@/components/ui/slice-pie'
import type { DepositTransactionRowT } from '@/types/transfers'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import { costTotalsPieSlices } from '@/lib/kosztorys/chart-slices'

type PropsT = {
  investmentId: number
  settlementMode: SettlementModeT
  onSettlementModeChange?: (mode: SettlementModeT) => void
  isSavingSettings?: boolean
  laborCostsNet: number
  amountDue: MoneyPairT
  materials: MaterialsT
  discountAmount: number
  lossAmount: number
  reconciliation: KosztorysReconciliationT
  priceView: PriceViewT
  vatRate: number
  materialsNetRate: number | null
  paidPair: MoneyPairT
  depositRows: DepositTransactionRowT[]
  showDeposits?: boolean
  preview?: boolean
  showPie?: boolean
}

export function SummaryOverviewTab({
  investmentId,
  settlementMode,
  onSettlementModeChange,
  isSavingSettings = false,
  laborCostsNet,
  amountDue,
  materials,
  discountAmount,
  lossAmount,
  reconciliation,
  priceView,
  vatRate,
  materialsNetRate,
  paidPair,
  depositRows,
  showDeposits = true,
  preview = false,
  showPie = true,
}: PropsT) {
  const moneyAxis = settlementModeToMoneyAxis(settlementMode)
  const settlementGroups = buildSettlementGroups({
    paid: paidPair,
    amountDue,
    lossAmount,
    axis: moneyAxis,
  })
  const materialsBilled = billedMaterials(materials, materialsNetRate)
  const materialsPair = faceValue(materialsBilled)
  const offPlane = offPlaneDeposits(depositRows, settlementMode)

  return (
    <div className="flex w-full flex-col gap-y-4">
      {onSettlementModeChange && (
        <InlineModeSelect
          label="Rozliczenie robocizny"
          value={settlementMode}
          onValueChange={(next) => onSettlementModeChange(next as SettlementModeT)}
          options={SETTLEMENT_MODE_SELECT_OPTIONS}
          description={SETTLEMENT_MODE_DESCRIPTIONS[settlementMode]}
          disabled={isSavingSettings}
        />
      )}
      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="flex flex-col gap-y-4">
          <SettlementSummary
            investmentId={investmentId}
            laborCostsNet={laborCostsNet}
            materialsPair={materialsPair}
            moneyAxis={moneyAxis}
            settlementGroups={settlementGroups}
            discountAmount={discountAmount}
            reconciliation={reconciliation}
            priceView={priceView}
            vatRate={vatRate}
            preview={preview}
          />
          {!preview && settlementMode !== 'MIXED' && offPlane.length > 0 && (
            <SettlementPlaneWarning rows={offPlane} mode={settlementMode} />
          )}
        </div>
        {showPie && (
          <SlicePie
            slices={costTotalsPieSlices(
              laborCostsNetPreDiscount(laborCostsNet, discountAmount),
              materialsPair.net,
            )}
          />
        )}
      </div>
      {showDeposits && (
        <div>
          <div className="w-fit">
            <div className="flex items-center gap-2 py-2 text-left">
              <h2 className="text-foreground text-sm font-medium">
                {preview ? (
                  'Lista wpłat'
                ) : (
                  <Link
                    href={investmentTransfersHref(investmentId, { types: DEPOSIT_TYPES })}
                    className="hover:underline"
                  >
                    Lista wpłat
                  </Link>
                )}
              </h2>
            </div>
            <Separator orientation="horizontal" />
          </div>
          <div className="pt-4">
            <SummaryDepositsTab
              investmentId={investmentId}
              rows={depositRows}
              settlementMode={settlementMode}
              preview={preview}
            />
          </div>
        </div>
      )}
    </div>
  )
}
