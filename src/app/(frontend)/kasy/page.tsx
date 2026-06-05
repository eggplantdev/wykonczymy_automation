import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchVisibleRegisters } from '@/lib/queries/cash-registers'
import { CashRegistersTable } from '@/components/cash-registers/cash-registers-table'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function CashRegistersPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const { registers } = await fetchVisibleRegisters()

  return (
    <PageWrapper title="Kasy">
      <CashRegistersTable data={registers} />
    </PageWrapper>
  )
}
