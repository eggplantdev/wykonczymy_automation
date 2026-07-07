import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { fetchAllLeads } from '@/lib/queries/leads'
import { LeadsDataTable } from '@/components/leads/leads-data-table'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function LeadsPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const leads = await fetchAllLeads()
  const newCount = leads.filter((lead) => lead.contactStatus === 'new' && !lead.isTest).length

  return (
    <PageWrapper title="Zgłoszenia">
      <Description>{newCount} nowych</Description>
      <LeadsDataTable data={leads} />
    </PageWrapper>
  )
}
