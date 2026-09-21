import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES, isAdminOrOwnerRole } from '@/lib/auth/roles'
import { STREAMS, markSeen } from '@/lib/db/notifications'
import { fetchLeadsPage, LEADS_DEFAULT_LIMIT } from '@/lib/queries/leads'
import { parseLeadSort } from '@/lib/queries/lead-sort'
import { parsePagination } from '@/lib/utils/pagination'
import { fetchRecipientLists } from '@/lib/queries/notification-recipients'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { LeadsDataTable } from '@/components/leads/leads-data-table'
import { RecipientListCard } from '@/components/notification-recipients/recipient-list-card'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'
import type { PagePropsT } from '@/types/page'

export default async function LeadsPage({ searchParams }: PagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const sp = await searchParams
  const { page, limit } = parsePagination(sp, LEADS_DEFAULT_LIMIT)
  const sort = parseLeadSort(sp)
  const search = typeof sp.search === 'string' ? sp.search : ''

  // Viewing the list clears this user's unread badge — advance their read cursor.
  // Independent of the leads fetch, so overlap them rather than paying the write
  // round-trip before the (cached) read.
  const payload = await getPayload({ config })
  const [, leads, recipients, refData] = await Promise.all([
    markSeen(payload, session.user.id, STREAMS.leads),
    fetchLeadsPage(page, limit, sort, search),
    fetchRecipientLists(),
    fetchReferenceData(),
  ])
  // Trimmed to what the picker renders — the reference row carries the investment's address, phone
  // and notes, and none of that belongs in the client payload of a leads table.
  const investmentOptions = refData.investments.map(({ id, name }) => ({ id, name }))
  const canEditRecipients = isAdminOrOwnerRole(session.user.role)

  return (
    <PageWrapper title="Zgłoszenia">
      <Description>{leads.newCount} nowych</Description>
      <LeadsDataTable
        data={leads.rows}
        paginationMeta={leads.paginationMeta}
        investments={investmentOptions}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <RecipientListCard
          list="newLead"
          title="Powiadomienia o nowych zgłoszeniach"
          emails={recipients.newLead}
          canEdit={canEditRecipients}
        />
        <RecipientListCard
          list="opsAlerts"
          title="Alerty techniczne"
          emails={recipients.opsAlerts}
          canEdit={canEditRecipients}
        />
      </div>
    </PageWrapper>
  )
}
