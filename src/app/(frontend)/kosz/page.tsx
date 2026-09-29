import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_ROLES } from '@/lib/auth/roles'
import { getTrashedInvestments } from '@/lib/queries/trash'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'
import { TrashedInvestmentsList } from '@/components/trash/trashed-investments-list'

export default async function TrashPage() {
  const session = await requireAuth(ADMIN_OR_OWNER_ROLES)
  if (!session.success) redirect('/zaloguj')

  return (
    <PageWrapper title={PAGE_TITLES.trash}>
      <TrashedInvestmentsList investments={await getTrashedInvestments()} />
    </PageWrapper>
  )
}
