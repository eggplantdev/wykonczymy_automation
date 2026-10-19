import { fetchInvestmentAssets } from '@/lib/queries/investment-assets'
import { InvestmentAssetsControl } from '@/components/investments/investment-assets-control'

export async function InvestmentAssetsSection({ investmentId }: { investmentId: number }) {
  const assets = await fetchInvestmentAssets(investmentId)

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex min-h-7 items-center text-sm font-medium">Zdjęcia i pliki</h2>
      <InvestmentAssetsControl investmentId={investmentId} assets={assets} />
    </section>
  )
}
