import { fetchInvestmentAssets } from '@/lib/queries/investment-assets'
import { InvestmentAssetsControl } from '@/components/investments/investment-assets-control'

export async function InvestmentAssetsSection({ investmentId }: { investmentId: number }) {
  const assets = await fetchInvestmentAssets(investmentId)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Zdjęcia i pliki</h2>
      <InvestmentAssetsControl investmentId={investmentId} assets={assets} />
    </section>
  )
}
