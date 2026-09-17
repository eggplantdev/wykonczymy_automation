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
} from '@/components/kosztorys/summary/settlement-mode-options'
import { buildSettlementGroups } from '@/components/kosztorys/summary/settlement-groups'
import { SettlementPlaneWarning } from '@/components/kosztorys/summary/settlement-plane-warning'
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
  // Picks Mixed vs Brutto/Netto here, and is the value the inline control writes. Supplying the
  // writer is what turns that control on — same gate as the popover's: a read-only host passes the
  // value and no writer.
  settlementMode: SettlementModeT
  onSettlementModeChange?: (mode: SettlementModeT) => void
  isSavingSettings?: boolean
  laborCostsNet: number
  amountDue: MoneyPairT
  materials: MaterialsT
  discountAmount: number
  // Σ LOSS — the deduction step between the wpłaty and the closing figure. Face value on both axes.
  lossAmount: number
  reconciliation: KosztorysReconciliationT
  priceView: PriceViewT
  vatRate: number
  // The investment's saved materiały netto rate (null = off), already gated on the settlement mode
  // by the panel — feeds every materiały figure in this tab.
  materialsNetRate: number | null
  // The same wpłaty on BOTH planes, each crossed at VAT by the plane it was paid on — the deduction
  // step every tryb subtracts from „Łącznie".
  paidPair: MoneyPairT
  // The individual wpłaty, for the folded list below the settlement.
  depositRows: DepositTransactionRowT[]
  // Off on a host whose own transfers table already lists every wpłata (the investment page), where a
  // second copy of the same list is noise rather than detail.
  showDeposits?: boolean
  preview?: boolean
  showPie?: boolean
}

// The „Podsumowanie" view: the settlement block, then the folded wpłaty list.
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
  // What the investor is billed for materiały, feeding both the Podsumowanie row and the „Struktura
  // kosztów" pie so the two can never disagree. The pie is a netto robocizna/materiały split,
  // identical in every mode, so it sits here beside the settlement rather than inside any one mode's
  // block. Robocizna enters the pie PRZED rabatem: a rabat is a concession on the price, not a change
  // in what the job is made of, and a rabat exceeding the executed work would otherwise feed the pie
  // a negative slice.
  const materialsBilled = billedMaterials(materials, materialsNetRate)
  const materialsPair = faceValue(materialsBilled)
  const offPlane = offPlaneDeposits(depositRows, settlementMode)

  return (
    <div className="flex w-full flex-col gap-y-4">
      {/* Above the row, not inside its left column: nested there it pushed the settlement table down
          while the pie stayed put, and the tab lost its top edge. */}
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
          {/* Owner-only: the client can't act on the plane mismatch and shouldn't see the doubt. */}
          {!preview && settlementMode !== 'MIXED' && offPlane.length > 0 && (
            <SettlementPlaneWarning rows={offPlane} mode={settlementMode} />
          )}
        </div>
        {showPie && (
          <SlicePie
            // Both slices on the netto plane — a share of two different planes is not a share.
            // Shares only: a percent is the whole point here, and the money is already in the table
            // beside it.
            slices={costTotalsPieSlices(
              laborCostsNetPreDiscount(laborCostsNet, discountAmount),
              materialsPair.net,
            )}
          />
        )}
      </div>
      {showDeposits && (
        <div>
          {/* The open CollapsibleSection's own head, minus the trigger — same type, padding and rule,
              so this section keeps the rhythm of the collapsible ones on the other tabs. */}
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
