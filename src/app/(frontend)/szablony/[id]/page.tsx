import { notFound } from 'next/navigation'
import { parseInvestmentId } from '@/lib/queries/investment-id'
import { getTemplateName } from '@/lib/queries/presets'
import { getTemplateTree } from '@/lib/queries/kosztorys'
import { getWorkCatalogue } from '@/lib/queries/work-catalogue'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { KosztorysEditorV2 } from '@/components/kosztorys/editor/kosztorys-editor-v2'
import { templateEditorActions } from '@/components/kosztorys/editor/template-editor-actions'
import type { DynamicPagePropsT } from '@/types/page'

// A szablon has its own tables, read into the kosztorys tree shape — but none of the investment
// editor's financial fetches: a szablon has no transactions, no przedmiar and no figures to
// reconcile. Read-only, so a hover prefetch of a row href is safe.
export default async function TemplatePage({ params }: DynamicPagePropsT) {
  const { id } = await params
  const templateId = parseInvestmentId(id)

  await requireManagementPage()

  // Before the tree, not beside it: the tree read throws on an id that is no szablon, and a
  // rejected `Promise.all` renders the error page where this should be a 404.
  const name = await getTemplateName(templateId)
  if (name === undefined) notFound()

  const [tree, workCatalogue] = await Promise.all([
    getTemplateTree(templateId),
    getWorkCatalogue(),
  ])

  return (
    <KosztorysEditorV2
      investmentId={templateId}
      tree={tree}
      investmentName={name}
      isTemplate
      actions={templateEditorActions}
      workCatalogue={workCatalogue}
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
