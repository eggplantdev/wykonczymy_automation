import { fetchInvestmentAssets } from '@/lib/queries/investment-assets'
import { InvestmentAssetsControl } from '@/components/investments/investment-assets-control'

/** Owns the assets read so the client gallery takes data, not a promise, and the page can stream it. */
export async function InvestmentAssetsSection({ investmentId }: { investmentId: number }) {
  const assets = await fetchInvestmentAssets(investmentId)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Zdjęcia i pliki</h2>
      <InvestmentAssetsControl investmentId={investmentId} assets={assets} />
    </section>
  )
}
