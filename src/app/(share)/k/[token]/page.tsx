import { notFound } from 'next/navigation'
import { getClientKosztorysByToken } from '@/lib/queries/client-kosztorys'
import { ClientKosztorysView } from '@/components/kosztorys/client/client-kosztorys-view'

// The public entrance. A revoked token and a token that never existed both land on the same 404, so
// the page never reveals which investments exist.
export default async function SharedKosztorysPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const view = await getClientKosztorysByToken(token)
  if (!view) notFound()

  return <ClientKosztorysView view={view} />
}
