import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES, ROLE_LABELS } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/pagination'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { buildTransferFilters } from '@/lib/queries/transfers'
import { buildFilterConfig } from '@/lib/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import type { DynamicPagePropsT } from '@/types/page'

export default async function UserDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user: currentUser } = session

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)

  const userId = Number(id)
  const refData = await fetchReferenceData()

  const worker = refData.workers.find((w) => w.id === userId)
  if (!worker) notFound()

  const role = worker.type
  const registerName = worker.defaultCashRegisterId
    ? refData.cashRegisters.find((cr) => cr.id === worker.defaultCashRegisterId)?.name
    : undefined

  const infoFields = [
    { label: 'Rola', value: ROLE_LABELS[role].pl },
    { label: 'Email', value: worker.email || '—' },
    { label: 'Status', value: worker.active ? 'Aktywny' : 'Nieaktywny' },
    ...(registerName ? [{ label: 'Domyślna kasa', value: registerName }] : []),
  ]

  const urlFilters = buildTransferFilters(sp, { id: currentUser.id })
  const transferWhere = { ...urlFilters, worker: { equals: userId } }

  return (
    <PageWrapper title={worker.name} backHref="/pracownicy" backLabel="Pracownicy">
      <InfoList items={infoFields} />
      <TransfersSection
        config={{
          query: { where: transferWhere, page, limit },
          baseUrl: `/pracownicy/${id}`,
          excludeColumns: ['worker'],
          filters: buildFilterConfig(refData, 'users'),
        }}
      />
    </PageWrapper>
  )
}
