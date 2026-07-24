'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { CoeffField } from '@/components/kosztorys/coeff-field'
import { MaterialsBreakdownTable } from '@/components/kosztorys/materials-breakdown-table'
import { MaterialsTransactionsTable } from '@/components/kosztorys/materials-transactions-table'
import { formatNet } from '@/lib/kosztorys/format'
import { cn } from '@/lib/utils/cn'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { MaterialTransactionRowT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  // Materiały brutto — server sum of the unsettled transactions; 0 hides the breakdown + controls.
  materialsGross: number
  materialyBreakdown: MaterialyBreakdownRowT[]
  materialTransactions: MaterialTransactionRowT[]
  // Netto column is on show (axis ≠ Brutto) — gates the netto-pricing controls.
  nettoShown: boolean
  // Materiały-netto pricing toggle + its setter (shared panel state — also feeds the Podsumowanie
  // materiały figure, so it stays lifted rather than owned here).
  materialsAsNet: boolean
  onMaterialsAsNetChange: (value: boolean) => void
  // Brutto→netto reduction %, shared panel state seeded from the VAT rate.
  materialsReductionPercent: number
  onMaterialsReductionPercentChange: (value: number) => void
  // Read-only client render — no row links on the transactions list.
  clientView?: boolean
}

// The „Wydatki" view: per-category materiały breakdown, the brutto→netto pricing controls (checkbox +
// reduction %, shared with the Podsumowanie materiały figure), and the flat wydatki transactions list.
export function SummaryExpensesTab({
  investmentId,
  materialsGross,
  materialyBreakdown,
  materialTransactions,
  nettoShown,
  materialsAsNet,
  onMaterialsAsNetChange,
  materialsReductionPercent,
  onMaterialsReductionPercentChange,
  clientView = false,
}: PropsT) {
  const materialsReduction = materialsReductionPercent / 100
  const materialsReductionAmount = materialsGross * materialsReduction

  return (
    <div className="flex w-full flex-col">
      {materialsGross !== 0 && (
        <MaterialsBreakdownTable
          rows={materialyBreakdown}
          reduction={materialsReduction}
          showReduction={nettoShown && materialsAsNet}
        />
      )}
      <div className="my-2 flex w-fit flex-col gap-2">
        {nettoShown && materialsGross !== 0 && (
          <label
            className={cn(
              'flex w-fit cursor-pointer items-center gap-2 text-xs',
              materialsAsNet ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <Checkbox
              checked={materialsAsNet}
              onCheckedChange={(value) => onMaterialsAsNetChange(value === true)}
            />
            Zaznacz jeśli wydatki mają być rozliczane po kwocie netto
          </label>
        )}
        {nettoShown && materialsGross !== 0 && materialsAsNet && (
          <>
            <span className="text-muted-foreground text-xs">Stawka netto wydatków</span>
            <div className="flex items-center gap-2">
              <CoeffField
                label=""
                value={materialsReductionPercent}
                onCommit={(n) => n != null && onMaterialsReductionPercentChange(n)}
              />
              <span className="text-muted-foreground text-xs">
                % (−{formatNet(materialsReductionAmount)} zł)
              </span>
            </div>
          </>
        )}
      </div>
      <MaterialsTransactionsTable
        investmentId={investmentId}
        rows={materialTransactions}
        clientView={clientView}
      />
    </div>
  )
}
