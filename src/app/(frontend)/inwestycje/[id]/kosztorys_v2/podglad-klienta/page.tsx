import { requireInvestmentOr404 } from '@/lib/queries/investments'
import { getClientKosztorysPreview } from '@/lib/queries/client-kosztorys'
import { KosztorysEditorBody } from '@/components/kosztorys/kosztorys-editor-body'

// „Podgląd dla klienta": exactly what a share link serves, rendered behind the app's own auth.
// Mounts the same body the public /k/<token> route does and reads the same data, so the preview is
// a real check on what leaves the building — not a separate rendering that could differ.
export default async function ClientPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // The shared guard, like every other investment page: a dead session redirects to login and a
  // missing investment 404s, instead of the query's throw surfacing as a 500 through global-error.
  const { investmentId } = await requireInvestmentOr404(id)
  const data = await getClientKosztorysPreview(investmentId)

  return <KosztorysEditorBody clientView {...data} />
}
