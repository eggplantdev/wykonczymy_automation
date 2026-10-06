import { redirect, notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewRegister, isManagementRole, ROLES } from '@/lib/auth/roles'
import { parsePagination } from '@/lib/utils/pagination'
import { parseTransferSort } from '@/lib/queries/transfer-sort'
import { fetchReferenceData, findWorkerRef } from '@/lib/queries/reference-data'
import { fetchRegisterBalances } from '@/lib/queries/balances'
import { buildTransferFilters } from '@/lib/queries/transfer-filters'
import { cashRegisterDeleteBlocker } from '@/lib/cash-registers/delete-blocker'
import { perfStart } from '@/lib/perf'
import { buildFilterConfig } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { EditCashRegisterDialog } from '@/components/dialogs/edit-cash-register-dialog'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import type { Where } from 'payload'
import type { DynamicPagePropsT } from '@/types/page'

export default async function CashRegisterDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const step = perfStart()
  const session = await requireAuth(ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user } = session
  if (!isManagementRole(user.role)) notFound()

  const { id } = await params
  const sp = await searchParams
  const { page, limit } = parsePagination(sp)
  const sort = parseTransferSort(sp)

  const registerId = Number(id)
  // Strip sourceRegister from URL params — the page already scopes to this
  // register via its own OR clause. Passing it through would collide (both
  // produce `where.or`).
  const { sourceRegister: _, ...filteredSp } = sp
  const urlFilters = buildTransferFilters(filteredSp, { id: user.id })
  const transferWhere: Where = {
    ...urlFilters,
    or: [{ sourceRegister: { equals: registerId } }, { targetRegister: { equals: registerId } }],
  }

  const [refData, balanceRecord] = await Promise.all([
    fetchReferenceData(),
    fetchRegisterBalances(),
  ])
  console.log(`[PERF] kasa/${id} fetchReferenceData + fetchRegisterBalances ${step()}ms`)

  const register = refData.cashRegisters.find((cr) => cr.id === registerId)
  if (!register) notFound()

  const registerBalance = balanceRecord[String(registerId)] ?? 0

  if (!canViewRegister(user.role, register.type)) notFound()

  const ownerName = register.ownerId ? (findWorkerRef(refData, register.ownerId)?.name ?? '—') : '—'

  const isOwnerLocked =
    (await cashRegisterDeleteBlocker(await getPayload({ config }), registerId)) !== undefined

  return (
    <PageWrapper title={register.name}>
      <EditCashRegisterDialog
        register={register}
        workers={refData.workers}
        isOwnerLocked={isOwnerLocked}
      />
      <InfoList items={[{ label: 'Właściciel', value: ownerName }]} />
      <SignedMoneyDisplay amount={registerBalance} />

      {/* Transactions table */}
      <TransfersSection
        title="Transfery"
        config={{
          query: { where: transferWhere, page, limit, sort },
          baseUrl: `/kasa/${id}`,
          filters: buildFilterConfig(refData, 'cashRegisters'),
          invoiceDownload: true,
          print: true,
          cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
        }}
      />
    </PageWrapper>
  )
}
