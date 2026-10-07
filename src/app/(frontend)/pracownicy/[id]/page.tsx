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
import { fetchWorkerReportHistory } from '@/lib/queries/worker-report-history'
import { workerPageTransferWhere, workerTransferScope } from '@/lib/queries/worker-transfers'
import { fetchTransferFacets } from '@/lib/queries/transfer-totals'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'
import { toOptions } from '@/lib/utils/build-filter-config'
import { TransfersSection } from '@/components/transfers/transfers-section'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { HeldEquipmentSection } from '@/components/equipment/held-equipment-section'
import { OwnedRegistersSection } from '@/components/users/owned-registers-section'
import { WorkerInvestmentsSection } from '@/components/users/worker-investments-section'
import { WorkerQuickActions } from '@/components/users/worker-quick-actions'
import { WorkerExpenseDraftsSection } from '@/components/worker-expenses/worker-expense-drafts-section'
import { WorkerReportsSection } from '@/components/worker-reports/worker-reports-section'
import { visibleWorkerRegisters } from '@/lib/workers/owned-registers'
import { isActiveRef } from '@/lib/utils/is-active-ref'
import { FRONTEND_URL } from '@/lib/env'
import { workerReportShareUrl } from '@/lib/kosztorys/worker-view/worker-links'
import { EditWorkerDialog } from '@/components/dialogs/edit-worker-dialog'
import { AccountCredentialsDialog } from '@/components/dialogs/account-credentials-dialog'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { InfoList } from '@/components/ui/info-list'
import type { DynamicPagePropsT } from '@/types/page'

// Hidden at one option: the few rows it would set apart don't earn a control.
const offeredIfChoice = <T,>(options: T[]) => (options.length > 1 ? options : undefined)

export default async function UserDetailPage({ params, searchParams }: DynamicPagePropsT) {
  const session = await requireAuth(ROLES)
  if (!session.success) redirect('/zaloguj')
  const { user: currentUser } = session
  const isManager = isManagementRole(currentUser.role)

  const { id } = await params
  if (!canViewWorkerPage(currentUser, Number(id))) notFound()
  const sp = await searchParams
  const { page, limit } = parsePagination(sp, 10)
  const sort = parseTransferSort(sp)

  const userId = Number(id)
  const isOwnPage = currentUser.id === userId
  const refDataPromise = fetchReferenceData()
  // The scope alone, not the URL filters: picking one option must not shrink its own list.
  const facetsPromise = refDataPromise.then(({ cashRegisters }) =>
    fetchTransferFacets(
      workerTransferScope(
        userId,
        visibleWorkerRegisters(cashRegisters, userId, currentUser.role).map(({ id }) => id),
      ),
    ),
  )
  const [
    locale,
    refData,
    facets,
    balances,
    heldEquipment,
    stageInvestments,
    expenseDrafts,
    workReports,
  ] = await Promise.all([
    fetchUserLanguage(currentUser.id),
    refDataPromise,
    facetsPromise,
    fetchRegisterBalances(),
    fetchEquipmentAtLocation({ kind: 'holder', id: userId }),
    fetchWorkerStageInvestments(userId),
    fetchWorkerExpenseDrafts(userId),
    fetchWorkerReportHistory(userId),
  ])

  const worker = refData.workers.find((w) => w.id === userId)
  if (!worker) notFound()

  const role = worker.role
  const registerName = worker.defaultCashRegisterId
    ? refData.cashRegisters.find((cr) => cr.id === worker.defaultCashRegisterId)?.name
    : undefined

  const registers = visibleWorkerRegisters(refData.cashRegisters, userId, currentUser.role)
  const registerIds = registers.map((register) => register.id)
  // The server refuses an inactive kasa, so offering one only leads to a refusal.
  const sendableRegisters = registers.filter(isActiveRef)
  // The link reports as the worker, whoever opens it — so only he is given it.
  const investmentLinks = stageInvestments.map(({ investmentId, name, token }) => ({
    investmentId,
    name,
    reportUrl:
      isOwnPage && token ? workerReportShareUrl(FRONTEND_URL, name, worker.name, token) : undefined,
  }))
  const transferWhere = workerPageTransferWhere(sp, currentUser.id, userId, registerIds)
  const transferInvestments = refData.investments.filter(({ id }) =>
    facets.investmentIds.includes(id),
  )
  const transferTypes = TRANSFER_TYPES.filter((type) => facets.types.includes(type))

  const { t } = createTranslator(locale, 'workerPage')
  const infoFields = [
    ...(isManager ? [{ label: t('role'), value: t(ROLE_KEYS[role]) }] : []),
    { label: t('email'), value: worker.email },
    ...(isManager ? [{ label: t('status'), value: t(worker.active ? 'active' : 'inactive') }] : []),
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
      {isOwnPage && (
        <WorkerQuickActions
          investmentLinks={investmentLinks}
          sendableRegisters={sendableRegisters}
          defaultRegisterId={worker.defaultCashRegisterId}
          locale={locale}
        />
      )}
      <OwnedRegistersSection
        registers={registers}
        balances={balances}
        linkable={isManager}
        locale={locale}
      />
      <HeldEquipmentSection equipment={heldEquipment} linkable={isManager} locale={locale} />
      <WorkerInvestmentsSection
        investments={investmentLinks}
        canReport={isOwnPage}
        locale={locale}
      />
      <WorkerExpenseDraftsSection
        drafts={expenseDrafts}
        investments={stageInvestments}
        canSend={isOwnPage}
        canOpenTransfers={isManager}
        sendableRegisters={sendableRegisters}
        locale={locale}
      />
      <WorkerReportsSection reports={workReports} canOpenInKosztorys={isManager} locale={locale} />
      <CollapsibleSection
        title={t('transfers')}
        storageKey="worker:transfers"
        defaultOpen={false}
        withSeparator={false}
      >
        <TransfersSection
          config={{
            query: { where: transferWhere, page, limit, sort },
            baseUrl: `/pracownicy/${id}`,
            excludeColumns: isManager
              ? ['worker']
              : ['worker', 'actions', 'vatPlane', 'paymentMethod', 'createdAt'],
            filters: {
              cashRegisters: offeredIfChoice(toOptions(registers)),
              investments: offeredIfChoice(toOptions(transferInvestments)),
              transferTypes: offeredIfChoice(transferTypes),
              otherCategories: toOptions(refData.otherCategories),
              showCancelledFilter: false,
              showSearchFilters: false,
            },
            invoiceDownload: isManager,
            print: isManager,
            cancelledTransactionAudit: sp.cancelledTransactionAudit === '1',
          }}
        />
      </CollapsibleSection>
    </PageWrapper>
  )
}
