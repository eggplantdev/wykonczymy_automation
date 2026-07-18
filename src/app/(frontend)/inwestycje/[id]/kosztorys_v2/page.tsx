import { parseInvestmentId, requireInvestmentOr404 } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
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
  const { investment } = await requireInvestmentOr404(id)
  const tree = await treePromise

  return (
    <KosztorysEditorV2 investmentId={investmentId} tree={tree} investmentName={investment.name} />
  )
}
