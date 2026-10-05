import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewWorkerPage, isManagementRole, ROLE_LABELS, ROLES } from '@/lib/auth/roles'
import { LanguageLabel } from '@/components/ui/language-label'
import { DEFAULT_LANGUAGE } from '@/lib/i18n/languages'
import { parsePagination } from '@/lib/utils/pagination'
import { parseTransferSort } from '@/lib/queries/transfer-sort'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchRegisterBalances } from '@/lib/queries/balances'
import { fetchEquipmentAtLocation } from '@/lib/queries/equipment'
import { buildTransferFilters } from '@/lib/queries/transfer-filters'
import { buildWorkerTransferWhere, workerTransferScope } from '@/lib/queries/worker-transfers'
import { buildFilterConfig } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { HeldEquipmentSection } from '@/components/equipment/held-equipment-section'
import { OwnedRegistersSection } from '@/components/users/owned-registers-section'
import { visibleWorkerRegisters } from '@/lib/workers/owned-registers'
import { EditWorkerDialog } from '@/components/dialogs/edit-worker-dialog'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import type { DynamicPagePropsT } from '@/types/page'

export default async function UserDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const session = await requireAuth(ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user: currentUser } = session
  const isManager = isManagementRole(currentUser.role)

  const { id } = await params
  if (!canViewWorkerPage(currentUser, Number(id))) notFound()
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)
  const sort = parseTransferSort(sp)

  const userId = Number(id)
  const [refData, balances, heldEquipment] = await Promise.all([
    fetchReferenceData(),
    fetchRegisterBalances(),
    fetchEquipmentAtLocation({ kind: 'holder', id: userId }),
  ])

  const worker = refData.workers.find((w) => w.id === userId)
  if (!worker) notFound()

  const role = worker.role
  const registerName = worker.defaultCashRegisterId
    ? refData.cashRegisters.find((cr) => cr.id === worker.defaultCashRegisterId)?.name
    : undefined

  const registers = visibleWorkerRegisters(refData.cashRegisters, userId, currentUser.role)
  const transferWhere = buildWorkerTransferWhere(
    buildTransferFilters(sp, { id: currentUser.id }),
    workerTransferScope(
      userId,
      registers.map((register) => register.id),
    ),
  )

  const infoFields = [
    { label: 'Rola', value: ROLE_LABELS[role].pl },
    { label: 'Email', value: worker.email },
    { label: 'Status', value: worker.active ? 'Aktywny' : 'Nieaktywny' },
    {
      label: 'Domyślny język',
      value: <LanguageLabel language={worker.language ?? DEFAULT_LANGUAGE} />,
    },
    ...(registerName ? [{ label: 'Domyślna kasa', value: registerName }] : []),
  ]

  return (
    <PageWrapper title={worker.name}>
      {isManager && <EditWorkerDialog worker={worker} cashRegisters={refData.cashRegisters} />}
      <InfoList items={infoFields} />
      <OwnedRegistersSection registers={registers} balances={balances} linkable={isManager} />
      <HeldEquipmentSection equipment={heldEquipment} linkable={isManager} />
      <TransfersSection
        title="Transfery"
        config={{
          query: { where: transferWhere, page, limit, sort },
          baseUrl: `/pracownicy/${id}`,
          excludeColumns: isManager ? ['worker'] : ['worker', 'actions'],
          filters: {
            ...buildFilterConfig(refData, ['users', 'workers', 'expenseCategories', 'type']),
            cashRegisters: registers.map(({ id, name }) => ({ id, name })),
          },
          invoiceDownload: true,
          print: true,
          workerScope: userId,
          cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
        }}
      />
    </PageWrapper>
  )
}
