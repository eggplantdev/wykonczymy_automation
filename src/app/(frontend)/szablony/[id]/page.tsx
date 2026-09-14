import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getDb } from '@/lib/db/get-db'
import { getPreset } from '@/lib/db/presets'
import { getWorkshopPresetId, resolveWorkshopInvestment } from '@/lib/db/workshop-investment'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { KosztorysEditorV2 } from '@/components/kosztorys/editor/kosztorys-editor-v2'

// The szablon workbench. The url names the SZABLON; the investment underneath is an implementation
// detail the user never sees — which is why the toolbar shows the szablon's name and why none of the
// five financial fetches the investment editor does happen here: a szablon has no transactions, no
// przedmiar and no figures to reconcile.
export default async function TemplateWorkshopPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const presetId = Number(id)
  if (!Number.isInteger(presetId) || presetId <= 0) notFound()

  await requireManagementPage()

  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const preset = await getPreset(db, presetId)
  if (!preset) notFound()

  // The workbench holds ONE szablon at a time, and „Otwórz" is what puts it there. A url typed by
  // hand (or a stale tab) would otherwise render whatever the workbench last held under this
  // szablon's name — someone else's content under someone else's title.
  const investmentId = await resolveWorkshopInvestment(payload)
  if ((await getWorkshopPresetId(db, investmentId)) !== presetId) redirect('/szablony')

  const tree = await getKosztorysTree(investmentId)

  return (
    <KosztorysEditorV2
      investmentId={investmentId}
      tree={tree}
      investmentName={preset.name}
      templateName={preset.name}
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
