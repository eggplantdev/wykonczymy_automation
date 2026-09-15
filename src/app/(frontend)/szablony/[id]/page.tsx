import { notFound } from 'next/navigation'
import { getWorkshopView } from '@/lib/queries/presets'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { KosztorysEditorV2 } from '@/components/kosztorys/editor/kosztorys-editor-v2'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { OpenWorkshopPrompt } from '@/components/presets/open-workshop-prompt'
import type { DynamicPagePropsT } from '@/types/page'

// The url names the SZABLON; the investment underneath is an implementation detail the user never
// sees — which is why the toolbar shows the szablon's name and why none of the five financial
// fetches the investment editor does happen here: a szablon has no transactions, no przedmiar and no
// figures to reconcile.
export default async function TemplateWorkshopPage({ params }: DynamicPagePropsT) {
  const { id } = await params
  const presetId = Number(id)
  if (!Number.isInteger(presetId) || presetId <= 0) notFound()

  await requireManagementPage()

  const workshop = await getWorkshopView(presetId)
  if (!workshop) notFound()

  // Says so rather than bouncing silently to the list, where the user would be left guessing why.
  if (workshop.investmentId == null) {
    return (
      <PageWrapper title={workshop.presetName}>
        <OpenWorkshopPrompt presetId={presetId} name={workshop.presetName} />
      </PageWrapper>
    )
  }

  const tree = await getKosztorysTree(workshop.investmentId)

  return (
    <KosztorysEditorV2
      investmentId={workshop.investmentId}
      tree={tree}
      investmentName={workshop.presetName}
      templatePresetId={presetId}
      materialsGrossBase={0}
      materialsNetBilled={0}
      materialsBreakdown={[]}
      settledBreakdown={[]}
      laborCostsNetFromTransactions={0}
      discountNetFromTransactions={0}
      investmentLoss={0}
      depositTransactions={[]}
      materialTransactions={[]}
    />
  )
}
