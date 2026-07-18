import { parseInvestmentId, requireInvestmentOr404 } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { fetchFilteredByType, fetchZaliczkiByStage } from '@/lib/queries/reference-data'
import { deriveFinancials } from '@/lib/db/sum-transfers'
import { KosztorysEditorV2 } from '@/components/kosztorys/kosztorys-editor-v2'

// The in-app kosztorys editor ("kosztorys_v2"). Always available — every investment has one,
// the editor renders its own empty state. The legacy Google Sheet lives at /kosztorys.
export default async function InvestmentKosztorysV2Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const investmentId = parseInvestmentId(id)

  const treePromise = getKosztorysTree(investmentId)
  // Read-only bridge to the financial plane: the investment's live material spend (unsettled
  // INVESTMENT_EXPENSE + CORRECTION), summed via the same cached path the detail page uses.
  const financialsPromise = fetchFilteredByType({ investment: { equals: investmentId } })
  // Per-etap zaliczki (tagged deposits) — same cached transfers plane, read-only.
  const zaliczkiPromise = fetchZaliczkiByStage(investmentId)
  const { investment } = await requireInvestmentOr404(id)
  const [tree, typeDistribution, zaliczkiByStage] = await Promise.all([
    treePromise,
    financialsPromise,
    zaliczkiPromise,
  ])
  const materialsNet = deriveFinancials(typeDistribution).totalMaterialCosts

  return (
    <KosztorysEditorV2
      investmentId={investmentId}
      tree={tree}
      investmentName={investment.name}
      materialsNet={materialsNet}
      zaliczkiByStage={zaliczkiByStage}
    />
  )
}
