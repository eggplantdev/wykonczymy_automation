import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchVisibleRegisters } from '@/lib/queries/cash-registers'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { CashRegistersTable } from '@/components/cash-registers/cash-registers-table'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'

export default async function CashRegistersPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const [{ registers }, refData] = await Promise.all([
    fetchVisibleRegisters(),
    fetchReferenceData(),
  ])

  return (
    <PageWrapper title={PAGE_TITLES.registers}>
      <CashRegistersTable data={registers} workers={refData.workers} />
    </PageWrapper>
  )
}
