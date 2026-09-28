import { requireInvestmentOr404 } from '@/lib/queries/investments'
import { getPreviewKosztorysById } from '@/lib/queries/preview-kosztorys'
import { getPreviewHistoryById } from '@/lib/queries/preview-kosztorys-history'
import { parseVersionParam } from '@/lib/kosztorys/history/version-param'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'
import type { DynamicPagePropsT } from '@/types/page'

// „Podgląd dla inwestora": the owner's faithful preview, rendered under the SAME bare (share) layout the
// public /k/<token> page uses — so the shell is byte-identical to what an investor gets, not the app's
// sidebar/nav. The (share) layout reads no session, so this page carries the whole auth gate itself:
// requireInvestmentOr404 redirects a dead session to /zaloguj and 404s a missing investment.
export default async function ClientPreviewPage({ params, searchParams }: DynamicPagePropsT) {
  const { id } = await params
  const { investmentId } = await requireInvestmentOr404(id)
  const data = await getPreviewKosztorysById(investmentId)
  const versionId = parseVersionParam((await searchParams).wersja)
  const history = await getPreviewHistoryById(investmentId, data.tree, versionId)

  // Keyed on the version: the grid seeds its rows once, at mount.
  return (
    <KosztorysEditorBody
      key={history.version?.id ?? 'current'}
      preview
      {...data}
      history={history}
    />
  )
}
