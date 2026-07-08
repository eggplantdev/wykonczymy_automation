import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { markLeadsSeen } from '@/lib/db/notifications'
import { fetchAllLeads } from '@/lib/queries/leads'
import { LeadsDataTable } from '@/components/leads/leads-data-table'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function LeadsPage() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  // Viewing the list clears this user's unread badge — advance their read cursor.
  // Independent of the leads fetch, so overlap them rather than paying the write
  // round-trip before the (cached) read.
  const payload = await getPayload({ config })
  const [, leads] = await Promise.all([markLeadsSeen(payload, session.user.id), fetchAllLeads()])
  const newCount = leads.filter((lead) => lead.contactStatus === 'new').length

  return (
    <PageWrapper title="Zgłoszenia">
      <Description>{newCount} nowych</Description>
      <LeadsDataTable data={leads} />
    </PageWrapper>
  )
}
