import { fetchInvestmentAssets } from '@/lib/queries/investment-assets'
import { InvestmentAssets } from '@/components/investments/investment-assets'

/** Owns the assets read so the client gallery takes data, not a promise, and the page can stream it. */
export async function InvestmentAssetsSection({ investmentId }: { investmentId: number }) {
  const assets = await fetchInvestmentAssets(investmentId)

  return <InvestmentAssets investmentId={investmentId} assets={assets} />
}
