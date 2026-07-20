import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { fetchFilteredByType } from '@/lib/queries/reference-data'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { kosztorysClientTotals } from '@/lib/kosztorys/settlement'
import { buildKosztorysReconciliation, reconciliationTooltip } from '@/lib/kosztorys/reconciliation'
import { Separator } from '@/components/ui/separator'
import { Description } from '@/components/ui/description'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { ReconMismatchBadge } from '@/components/kosztorys/recon-mismatch-badge'
import { formatPLN } from '@/lib/utils/format-currency'
import { cn } from '@/lib/utils/cn'

const RECON_LINES = [
  { label: 'Robocizna', key: 'laborCosts', subject: 'Transakcje robocizny' },
  { label: 'Rabat', key: 'rabat', subject: 'Transakcje rabatu' },
] as const

const ZKOSZTORYSU_TOOLTIP =
  'Robocizna i rabat wyliczone z kosztorysu (ceny klienta, netto) — do porównania z sumą ' +
  'transakcji powyżej (Σ robocizny / Σ rabatu, też netto). Porównanie idzie netto ↔ netto. ' +
  'Czerwony wykrzyknik oznacza rozjazd między kosztorysem a transakcjami; zweryfikuj przed ' +
  'oznaczeniem inwestycji jako rozliczonej.'

type PropsT = {
  investmentId: number
}

// Async server component: the second reconciliation surface (client-view net vs the transaction sums),
// through the SAME `kosztorysClientTotals` path the editor Podsumowanie uses so the two planes can't
// drift. Rendered behind <Suspense> so its kosztorys-tree fetch (the page's long-pole query) stays off
// the critical render path. No kosztorys rows ⇒ null (the block is simply absent).
export async function InvestmentReconBlock({ investmentId }: PropsT) {
  const tree = await getKosztorysTree(investmentId)
  const rows = treeToRows(tree)
  if (rows.length === 0) return null

  // Transaction sums are fetched investment-wide here (never through the page's URL-filtered
  // `where`) so this surface can't diverge from the editor's Podsumowanie, which also compares
  // against the whole investment. Cancelled rows are excluded in SQL already.
  const financials = deriveFinancials(
    await fetchFilteredByType({ investment: { equals: investmentId } }),
  )

  const { sumaPracNet, rabatClientNet } = kosztorysClientTotals(
    rows,
    tree.stages,
    tree.globalDiscount,
  )
  const reconciliation = buildKosztorysReconciliation({
    sumaPracNet,
    rabatClientNet,
    laborCostsNetFromTransactions: financials.totalLaborCosts,
    investmentRabat: financials.totalRabat,
  })

  return (
    <>
      <Separator orientation="horizontal" className="mt-3" />
      <div className="text-muted-foreground space-y-1 text-sm">
        <Description>
          z kosztorysu (netto)
          <InfoTooltip
            content={ZKOSZTORYSU_TOOLTIP}
            label="Co to jest: z kosztorysu"
            className="ml-1"
          />
        </Description>
        {RECON_LINES.map(({ label, key, subject }) => {
          const recon = reconciliation[key]
          return (
            <div key={key} className="flex items-center gap-2">
              <span>{label}</span>
              <span className={cn('tabular-nums', recon.mismatch && 'text-destructive font-bold')}>
                {formatPLN(recon.expected)}
              </span>
              {recon.mismatch && (
                <ReconMismatchBadge content={reconciliationTooltip(recon, subject, formatPLN)} />
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
