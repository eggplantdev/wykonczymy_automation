import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_MANAGER_ROLES, ROLE_LABELS } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/utils/pagination'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchFilteredByType } from '@/lib/queries/transfer-totals'
import { fetchEquipmentAtLocation } from '@/lib/queries/equipment'
import { buildTransferFilters, stripCancelledFilters } from '@/lib/queries/transfer-filters'
import { buildFilterConfig } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { HeldEquipmentSection } from '@/components/equipment/held-equipment-section'
import { EditWorkerDialog } from '@/components/dialogs/edit-worker-dialog'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import type { DynamicPagePropsT } from '@/types/page'

export default async function UserDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const session = await requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)
  if (!session.success) redirect('/')
  const { user: currentUser } = session

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const userId = Number(id)
  const urlFilters = buildTransferFilters(sp, { id: currentUser.id })
  const transferWhere = { ...urlFilters, worker: { equals: userId } }

  // Stats ignore cancelled toggle — SQL already excludes cancelled via hardcoded WHERE clause
  const statsWhere = stripCancelledFilters(transferWhere)

  const [refData, typeDistribution, heldEquipment] = await Promise.all([
    fetchReferenceData(),
    fetchFilteredByType(statsWhere),
    fetchEquipmentAtLocation({ kind: 'holder', id: userId }),
  ])

  const worker = refData.workers.find((w) => w.id === userId)
  if (!worker) notFound()

  const role = worker.role
  const registerName = worker.defaultCashRegisterId
    ? refData.cashRegisters.find((cr) => cr.id === worker.defaultCashRegisterId)?.name
    : undefined

  const infoFields = [
    { label: 'Rola', value: ROLE_LABELS[role].pl },
    { label: 'Email', value: worker.email },
    { label: 'Status', value: worker.active ? 'Aktywny' : 'Nieaktywny' },
    ...(registerName ? [{ label: 'Domyślna kasa', value: registerName }] : []),
  ]

  const payoutsTotal = typeDistribution.find((row) => row.type === 'PAYOUT')?.total ?? 0

  return (
    <PageWrapper title={worker.name}>
      <EditWorkerDialog worker={worker} cashRegisters={refData.cashRegisters} />
      <InfoList items={infoFields} />
      <SignedMoneyDisplay amount={payoutsTotal} label="Wypłaty" />
      <HeldEquipmentSection equipment={heldEquipment} />
      <TransfersSection
        config={{
          query: { where: transferWhere, page, limit },
          baseUrl: `/pracownicy/${id}`,
          excludeColumns: ['worker'],
          filters: buildFilterConfig(refData, ['users', 'expenseCategories', 'type']),
          invoiceDownload: true,
          cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
        }}
      />
    </PageWrapper>
  )
}
