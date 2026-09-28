import { notFound } from 'next/navigation'
import { getPreviewKosztorysByToken } from '@/lib/queries/preview-kosztorys'
import { getPreviewHistoryByToken } from '@/lib/queries/preview-kosztorys-history'
import { parseVersionParam } from '@/lib/kosztorys/history/version-param'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'
import type { ResolvedSearchParamsT } from '@/types/page'

// The public entrance. A revoked token and a token that never existed both land on the same 404, so
// the page never reveals which investments exist.
export default async function SharedKosztorysPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<ResolvedSearchParamsT>
}) {
  const { token } = await params
  const data = await getPreviewKosztorysByToken(token)
  if (!data) notFound()

  const versionId = parseVersionParam((await searchParams).wersja)
  const history = await getPreviewHistoryByToken(token, data.tree, versionId)

  // Keyed on the version: the grid seeds its rows once, at mount.
  return (
    <KosztorysEditorBody
      key={history?.version?.id ?? 'current'}
      preview
      {...data}
      history={history ?? undefined}
    />
  )
}
