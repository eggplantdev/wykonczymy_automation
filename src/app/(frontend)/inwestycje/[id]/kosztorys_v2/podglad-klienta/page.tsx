import { parseInvestmentId } from '@/lib/queries/investments'
import { getClientKosztorysPreview } from '@/lib/queries/client-kosztorys'
import { ClientKosztorysView } from '@/components/kosztorys/client/client-kosztorys-view'

// „Podgląd dla klienta": exactly what a share link serves, rendered behind the app's own auth.
// Mounts the same component the public /k/<token> route does and reads the same projection, so the
// preview is a real check on what leaves the building — not a separate rendering that could differ.
export default async function ClientPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const view = await getClientKosztorysPreview(parseInvestmentId(id))

  return <ClientKosztorysView view={view} />
}
