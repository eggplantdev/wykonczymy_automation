import { InvestmentAssetsControl } from '@/components/investments/investment-assets-control'
import type { MediaFileT } from '@/types/media'

type InvestmentAssetsPropsT = {
  investmentId: number
  assets: MediaFileT[]
}

export function InvestmentAssets({ investmentId, assets }: InvestmentAssetsPropsT) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">Zdjęcia i pliki</h2>
      <InvestmentAssetsControl investmentId={investmentId} assets={assets} />
    </section>
  )
}
