import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { UserTransferView } from '@/components/user-transfer-view'
import type { DynamicPagePropsT } from '@/types/page'

export default async function UserDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')

  const { id } = await params
  const sp = await searchParams

  return (
    <UserTransferView
      userId={id}
      searchParams={sp}
      baseUrl={`/uzytkownicy/${id}`}
      backHref="/"
      backLabel="Kokpit"
      showInfo
    />
  )
}
