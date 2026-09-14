import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES, isAdminOrOwnerRole } from '@/lib/auth/roles'
import { STREAMS, markSeen } from '@/lib/db/notifications'
import { fetchEquipmentOverview } from '@/lib/queries/equipment'
import { fetchRecipientLists } from '@/lib/queries/notification-recipients'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { EquipmentDataTable } from '@/components/equipment/equipment-data-table'
import { RecipientListCard } from '@/components/notification-recipients/recipient-list-card'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { isLiveStatus } from '@/lib/equipment/equipment-status'
import { warsawToday } from '@/lib/utils/days'
import { pluralize } from '@/lib/utils/polish-plural'

export default async function EquipmentPage() {
  // Per-page, because `src/proxy.ts` only checks that a cookie exists — nothing else would catch a
  // missing guard here.
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const payload = await getPayload({ config })
  const [, { equipment, warehouses }, { workers, investments }, recipients] = await Promise.all([
    markSeen(payload, session.user.id, STREAMS.equipment),
    fetchEquipmentOverview(),
    fetchReferenceData(),
    fetchRecipientLists(),
  ])
  const inUse = equipment.filter((item) => isLiveStatus(item.status)).length

  return (
    <PageWrapper title="Sprzęt">
      <Description>
        {inUse} {pluralize(inUse, ['sztuka', 'sztuki', 'sztuk'])} w użyciu
      </Description>
      <EquipmentDataTable
        data={equipment}
        today={warsawToday()}
        workers={workers}
        warehouses={warehouses}
        investments={investments}
      />
      <RecipientListCard
        list="equipmentDigest"
        title="Powiadomienia"
        description="E-mail wysyłany na podane adresy na 30 i 7 dni przed końcem gwarancji."
        emails={recipients.equipmentDigest}
        canEdit={isAdminOrOwnerRole(session.user.role)}
      />
    </PageWrapper>
  )
}
