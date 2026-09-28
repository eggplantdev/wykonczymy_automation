import { notFound } from 'next/navigation'
import { getWorkshopView } from '@/lib/queries/presets'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { getWorkCatalogue } from '@/lib/queries/work-catalogue'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { TemplateWorkshop } from '@/components/presets/template-workshop'
import { OPEN_FLAG } from '@/components/presets/preset-open-href'
import type { DynamicPagePropsT } from '@/types/page'

// The investment underneath the szablon is an implementation detail the user never sees — which is why
// the toolbar shows the szablon's name and why none of the investment editor's financial fetches
// happen here: a szablon has no transactions, no przedmiar and no figures to reconcile.
//
// Read-only, so a hover prefetch of a row href is safe: loading the szablon into the warsztat is the
// host's action, fired from the browser.
export default async function TemplateWorkshopPage({ params, searchParams }: DynamicPagePropsT) {
  const { id } = await params
  const presetId = Number(id)
  if (!Number.isInteger(presetId) || presetId <= 0) notFound()

  await requireManagementPage()

  const workshop = await getWorkshopView(presetId)
  if (!workshop) notFound()

  const { investmentId } = workshop
  const [tree, workCatalogue, query] = await Promise.all([
    investmentId == null ? null : getKosztorysTree(investmentId),
    getWorkCatalogue(),
    searchParams,
  ])

  return (
    <TemplateWorkshop
      presetId={presetId}
      presetName={workshop.presetName}
      workCatalogue={workCatalogue}
      server={{ workshop: investmentId != null && tree ? { investmentId, tree } : null }}
      autoOpen={query[OPEN_FLAG] === '1'}
    />
  )
}
