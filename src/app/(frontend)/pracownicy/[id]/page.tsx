import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { canViewWorkerPage, isManagementRole, ROLES } from '@/lib/auth/roles'
import { LanguageLabel } from '@/components/ui/language-label'
import { AccountLanguageSelect } from '@/components/users/account-language-select'
import { DEFAULT_LANGUAGE } from '@/lib/i18n/languages'
import { createTranslator } from '@/lib/i18n/translations'
import { ROLE_KEYS } from '@/lib/i18n/role-keys'
import { fetchUserLanguage } from '@/lib/queries/user-language'
import { parsePagination } from '@/lib/utils/pagination'
import { parseTransferSort } from '@/lib/queries/transfer-sort'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchRegisterBalances } from '@/lib/queries/balances'
import { fetchEquipmentAtLocation } from '@/lib/queries/equipment'
import { fetchWorkerStageInvestments } from '@/lib/queries/worker-stage-investments'
import { fetchWorkerExpenseDrafts } from '@/lib/queries/worker-expense-drafts'
import { workerPageTransferWhere, workerTransferScope } from '@/lib/queries/worker-transfers'
import { fetchTransferFacets } from '@/lib/queries/transfer-totals'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'
import { buildFilterConfig } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { HeldEquipmentSection } from '@/components/equipment/held-equipment-section'
import { OwnedRegistersSection } from '@/components/users/owned-registers-section'
import { WorkerInvestmentsSection } from '@/components/users/worker-investments-section'
import { WorkerExpenseDraftsSection } from '@/components/worker-expenses/worker-expense-drafts-section'
import { visibleWorkerRegisters } from '@/lib/workers/owned-registers'
import { EditWorkerDialog } from '@/components/dialogs/edit-worker-dialog'
import { AccountCredentialsDialog } from '@/components/dialogs/account-credentials-dialog'
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
  const isOwnPage = currentUser.id === userId
  const [locale, refData, balances, heldEquipment, stageInvestments, expenseDrafts] =
    await Promise.all([
      fetchUserLanguage(currentUser.id),
      fetchReferenceData(),
      fetchRegisterBalances(),
      fetchEquipmentAtLocation({ kind: 'holder', id: userId }),
      fetchWorkerStageInvestments(userId),
      fetchWorkerExpenseDrafts(userId),
    ])

  const worker = refData.workers.find((w) => w.id === userId)
  if (!worker) notFound()

  const role = worker.role
  const registerName = worker.defaultCashRegisterId
    ? refData.cashRegisters.find((cr) => cr.id === worker.defaultCashRegisterId)?.name
    : undefined

  const registers = visibleWorkerRegisters(refData.cashRegisters, userId, currentUser.role)
  const registerIds = registers.map((register) => register.id)
  const transferWhere = workerPageTransferWhere(sp, currentUser.id, userId, registerIds)
  // The scope alone, not the URL filters: picking one option must not shrink its own list.
  const facets = await fetchTransferFacets(workerTransferScope(userId, registerIds))
  const transferInvestments = refData.investments.filter(({ id }) =>
    facets.investmentIds.includes(id),
  )
  const transferTypes = TRANSFER_TYPES.filter((type) => facets.types.includes(type))

  const { t } = createTranslator(locale, 'workerPage')
  const infoFields = [
    { label: t('role'), value: t(ROLE_KEYS[role]) },
    { label: t('email'), value: worker.email },
    { label: t('status'), value: t(worker.active ? 'active' : 'inactive') },
    {
      label: t('defaultLanguage'),
      value: isOwnPage ? (
        <AccountLanguageSelect userId={userId} language={worker.language ?? DEFAULT_LANGUAGE} />
      ) : (
        <LanguageLabel language={worker.language ?? DEFAULT_LANGUAGE} />
      ),
    },
    ...(registerName ? [{ label: t('defaultRegister'), value: registerName }] : []),
  ]

  return (
    <PageWrapper title={worker.name} className="pb-20 sm:pb-20 lg:pb-20">
      {(isManager || isOwnPage) && (
        <div className="flex flex-wrap gap-2">
          {isManager && <EditWorkerDialog worker={worker} cashRegisters={refData.cashRegisters} />}
          {isOwnPage && <AccountCredentialsDialog email={worker.email} />}
        </div>
      )}
      <InfoList items={infoFields} />
      <OwnedRegistersSection
        registers={registers}
        balances={balances}
        linkable={isManager}
        locale={locale}
      />
      <HeldEquipmentSection equipment={heldEquipment} linkable={isManager} locale={locale} />
      <WorkerInvestmentsSection
        investments={stageInvestments}
        workerName={worker.name}
        canReport={isOwnPage}
        locale={locale}
      />
      <WorkerExpenseDraftsSection
        drafts={expenseDrafts}
        investments={stageInvestments}
        canSend={isOwnPage}
        registers={registers}
        defaultRegisterId={worker.defaultCashRegisterId}
        locale={locale}
      />
      <TransfersSection
        title={t('transfers')}
        config={{
          collapsible: true,
          query: { where: transferWhere, page, limit, sort },
          baseUrl: `/pracownicy/${id}`,
          excludeColumns: isManager
            ? ['worker']
            : ['worker', 'actions', 'vatPlane', 'paymentMethod', 'createdAt'],
          filters: {
            ...buildFilterConfig(refData, ['users', 'workers', 'expenseCategories']),
            // A one-option filter narrows nothing.
            cashRegisters:
              registers.length > 1 ? registers.map(({ id, name }) => ({ id, name })) : undefined,
            investments:
              transferInvestments.length > 1
                ? transferInvestments.map(({ id, name }) => ({ id, name }))
                : undefined,
            showTypeFilter: transferTypes.length > 1,
            transferTypes,
            showCancelledFilter: false,
            showSearchFilters: false,
          },
          invoiceDownload: isManager,
          print: isManager,
          cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
        }}
      />
    </PageWrapper>
  )
}
