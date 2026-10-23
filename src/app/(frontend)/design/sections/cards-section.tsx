'use client'

import { Description } from '@/components/ui/description'
import { useState } from 'react'
import { Reorder } from 'framer-motion'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { CARD_LIST_CLASS, CARD_SHELL_CLASS, BORDERED_LIST_CLASS } from '@/components/ui/panel'
import { TransferCard } from '@/components/transfers/cards/transfer-card'
import { TransferCardList } from '@/components/transfers/cards/transfer-card-list'
import { getTransferColumns } from '@/components/tables/transfers'
import { RecipientListCard } from '@/components/notification-recipients/recipient-list-card'
import { UserRegisterStats } from '@/components/dashboard/user-register-stats'
import { FinancialStats } from '@/components/investments/financial-stats'
import { SummaryPanelContent } from '@/components/kosztorys/summary/summary-panel-content'
import { KosztorysTotalsPanel } from '@/components/kosztorys/summary/kosztorys-totals-panel'
import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'
import { KnowledgeEntryRow } from '@/components/company-knowledge/knowledge-entry-row'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useTranslation } from '@/hooks/use-translation'
import { buildKosztorysReconciliation } from '@/lib/kosztorys/reconciliation'
import { DISCOUNT_LABEL, INCOME_LABEL, LABOR_LABEL } from '@/lib/constants/financial-field-labels'
import { EMPTY_RELATION_NAME } from '@/lib/utils/get-relation-name'
import { formatPLN } from '@/lib/utils/format-currency'
import { cn } from '@/lib/utils/cn'
import type { CompanyKnowledgeEntryT } from '@/lib/company-knowledge/types'
import type { FinancialFieldT, MaterialsBreakdownRowT } from '@/types/investment-financials'
import type { DepositTransactionRowT, TransferRowT } from '@/types/transfers'
import type { CashRegisterRowT } from '@/types/table-rows'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

type FakeTransferT = Pick<TransferRowT, 'id' | 'type' | 'amount'> & Partial<TransferRowT>

function fakeTransfer(transfer: FakeTransferT): TransferRowT {
  return {
    description: '',
    netAmount: null,
    paymentMethod: 'CASH',
    date: '2026-10-14',
    sourceRegisterId: 1,
    sourceRegisterName: 'Kasa główna',
    targetRegisterId: null,
    targetRegisterName: EMPTY_RELATION_NAME,
    sourceRegisterTrashed: false,
    targetRegisterTrashed: false,
    investmentId: 1,
    investmentName: 'Mieszkanie Mokotów',
    expenseCategoryId: null,
    expenseCategoryName: EMPTY_RELATION_NAME,
    otherCategoryName: EMPTY_RELATION_NAME,
    otherCategoryId: null,
    workerName: EMPTY_RELATION_NAME,
    workerId: null,
    createdByName: 'Anna Testowa',
    createdById: 1,
    createdAt: '2026-10-14T09:30:00.000Z',
    invoices: [],
    invoiceNote: null,
    documentNumber: null,
    sellerNip: null,
    documentDate: null,
    cancelled: false,
    settled: false,
    vatPlane: null,
    originalType: null,
    payoutStatus: null,
    payoutDecidedAt: null,
    payoutRejectionReason: null,
    orderStatus: null,
    ...transfer,
  }
}

const TRANSFERS: TransferRowT[] = [
  fakeTransfer({
    id: 9101,
    type: 'INVESTMENT_EXPENSE',
    amount: 1845.5,
    description: 'Klej do płytek, fugi, grunt',
    expenseCategoryId: 3,
    expenseCategoryName: 'Materiały budowlane',
    paymentMethod: 'TRANSFER',
    invoiceNote: 'Faktura dojdzie mailem',
  }),
  fakeTransfer({
    id: 9102,
    type: 'INVESTMENT_EXPENSE_NET',
    amount: 2460,
    netAmount: 2000,
    expenseCategoryId: 4,
    expenseCategoryName: 'Armatura',
  }),
  fakeTransfer({
    id: 9103,
    type: 'INVESTOR_DEPOSIT',
    amount: 15000,
    sourceRegisterId: null,
    sourceRegisterName: EMPTY_RELATION_NAME,
    targetRegisterId: 1,
    targetRegisterName: 'Kasa główna',
    paymentMethod: 'TRANSFER',
  }),
  fakeTransfer({
    id: 9104,
    type: 'PAYOUT',
    amount: 3200,
    workerId: 7,
    workerName: 'Piotr Przykładowy',
    payoutStatus: 'pending',
  }),
  fakeTransfer({
    id: 9105,
    type: 'OTHER',
    amount: 120,
    description: 'Parking pod budową',
    otherCategoryId: 2,
    otherCategoryName: 'Dojazdy',
    cancelled: true,
  }),
  fakeTransfer({ id: 9106, type: 'CANCELLATION', amount: 120, description: 'Anulowanie #9105' }),
]

const RECIPIENT_EMAILS = ['biuro@example.com', 'kierownik@example.com']

const FINANCIAL_FIELDS: FinancialFieldT[] = [
  { label: 'Materiały budowlane', value: formatPLN(12480), amount: 12480 },
  { label: 'Armatura', value: formatPLN(5320), amount: 5320 },
  { label: LABOR_LABEL, value: formatPLN(28000), amount: 28000 },
  { label: INCOME_LABEL, value: formatPLN(35000), amount: 35000 },
  { label: DISCOUNT_LABEL, value: formatPLN(1500), amount: 1500 },
]

const SETTLED_FIELDS: FinancialFieldT[] = [
  { label: 'Chemia budowlana', value: formatPLN(640), amount: 640 },
]

const KNOWLEDGE_ENTRIES: CompanyKnowledgeEntryT[] = [
  {
    id: 1,
    topic: 'Gładzie',
    content: 'Dwie warstwy, szlif po każdej.\nGruntujemy przed malowaniem.',
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 2,
    topic: 'Hydroizolacja',
    content: 'Strefa prysznica do sufitu, reszta łazienki do 20 cm.',
    updatedAt: '2026-10-02T10:00:00.000Z',
  },
]

const EDITED_ENTRY: CompanyKnowledgeEntryT = { ...KNOWLEDGE_ENTRIES[0], id: 99 }

const MATERIALS_BREAKDOWN: MaterialsBreakdownRowT[] = [
  { id: 3, label: 'Materiały budowlane', net: 10146.34, origin: 'gross' },
  { id: 4, label: 'Armatura', net: 2000, origin: 'netBilled', recordedGross: 2460 },
]

const DEPOSITS: DepositTransactionRowT[] = [
  { id: 9103, date: '2026-10-14', amount: 15000, netAmount: null, vatPlane: 'NET' },
  { id: 9107, date: '2026-10-18', amount: 20000, netAmount: null, vatPlane: 'NET' },
]

const SUMMARY_PANEL_PROPS = {
  investmentId: 1,
  investmentName: 'Mieszkanie Mokotów',
  depositTransactions: DEPOSITS,
  laborCostsNet: 28000,
  materialsGrossBase: 12480,
  materialsNetBilled: 2000,
  materialsBreakdown: MATERIALS_BREAKDOWN,
  discountAmount: 1500,
  lossAmount: 0,
  reconciliation: buildKosztorysReconciliation({
    laborCostsNetFromKosztorys: 28000,
    discountNetFromKosztorys: 1500,
    laborCostsNetFromTransactions: 26500,
    discountNetFromTransactions: 1500,
  }),
  vatRate: 0.08,
  settlementMode: 'NET' as const,
  materialsNetRate: null,
}

const TOTALS_PANEL_HEIGHT = 512

function TransferCards() {
  const translator = useTranslation('transfers')
  const table = useReactTable({
    data: TRANSFERS,
    columns: getTransferColumns([], { translator }),
    getCoreRowModel: getCoreRowModel(),
  })
  const rows = table.getRowModel().rows

  return (
    <>
      <ShowcaseRow
        title="TransferCard — pojedyncze karty, każdy typ"
        source="transfers/cards/transfer-card.tsx"
        className="items-start"
      >
        {rows.map((row) => (
          <TransferCard key={row.id} row={row} className={cn(CARD_SHELL_CLASS, 'w-80')} />
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="TransferCard — uncoloredAmounts"
        source="<TransferCard uncoloredAmounts>"
        className="items-start"
      >
        {rows.slice(0, 3).map((row) => (
          <TransferCard
            key={row.id}
            row={row}
            uncoloredAmounts
            className={cn(CARD_SHELL_CLASS, 'w-80')}
          />
        ))}
      </ShowcaseRow>
      <ShowcaseRow
        title="TransferCardList (widok kart na telefonie; pusta lista → EmptyState)"
        source="transfers/cards/transfer-card-list.tsx"
        className="items-start"
      >
        <TransferCardList rows={rows.slice(0, 3)} className="max-w-sm" />
        <TransferCardList rows={[]} className="max-w-sm" />
      </ShowcaseRow>
    </>
  )
}

export function CardsSection() {
  const { id: currentUserId } = useCurrentUser()
  const [knowledgeIds, setKnowledgeIds] = useState(() => KNOWLEDGE_ENTRIES.map((entry) => entry.id))
  const registers: CashRegisterRowT[] = [
    {
      id: 1,
      name: 'Kasa główna',
      ownerName: 'Anna Testowa',
      ownerId: currentUserId,
      balance: 18420.5,
      type: 'MAIN',
      active: true,
    },
    {
      id: 2,
      name: 'Kasa pomocnicza',
      ownerName: 'Anna Testowa',
      ownerId: currentUserId,
      balance: -350,
      type: 'AUXILIARY',
      active: true,
    },
    {
      id: 3,
      name: 'Kasa wirtualna',
      ownerName: 'Firma',
      balance: 999,
      type: 'VIRTUAL',
      active: true,
    },
  ]

  return (
    <ShowcaseSection id="cards">
      <h3 className="mt-4 text-xs font-semibold tracking-wide uppercase">
        A. Klasy kart (ui/panel)
      </h3>
      <ShowcaseRow
        title="CARD_SHELL_CLASS / CARD_LIST_CLASS / BORDERED_LIST_CLASS"
        source="ui/panel.tsx"
        className="items-start"
      >
        <div className={cn(CARD_SHELL_CLASS, 'w-64 p-4 text-sm')}>CARD_SHELL_CLASS</div>
        <div className={cn(CARD_LIST_CLASS, 'max-w-64')}>
          {['Pierwsza', 'Druga', 'Trzecia'].map((label) => (
            <div key={label} className={cn(CARD_SHELL_CLASS, 'p-3 text-sm')}>
              {label} karta w CARD_LIST_CLASS
            </div>
          ))}
        </div>
        <ul className={cn(BORDERED_LIST_CLASS, 'w-64 text-sm')}>
          {['Pozycja 1', 'Pozycja 2', 'Pozycja 3'].map((label) => (
            <li key={label} className="px-3 py-2">
              {label}
            </li>
          ))}
        </ul>
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">B. Karty transakcji</h3>
      <TransferCards />

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        C. Karty ustawień i wiedzy
      </h3>
      <ShowcaseRow
        title="RecipientListCard (lista / pusta lista; edycja wyłączona — zapis trafiłby do prawdziwych list)"
        source="notification-recipients/recipient-list-card.tsx"
        className="items-start"
      >
        <div className="w-80">
          <RecipientListCard
            list="opsAlerts"
            title="Alerty operacyjne"
            description="Błędy synchronizacji i nieudane wysyłki."
            emails={RECIPIENT_EMAILS}
            canEdit={false}
          />
        </div>
        <div className="w-80">
          <RecipientListCard
            list="newLead"
            title="Nowe leady"
            emails={RECIPIENT_EMAILS.slice(0, 1)}
            canEdit={false}
          />
        </div>
        <div className="w-80">
          <RecipientListCard list="fleetDigest" title="Terminy floty" emails={[]} canEdit={false} />
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="KnowledgeEntryRow (przeciągany / statyczny / z edytorem)"
        source="company-knowledge/knowledge-entry-row.tsx"
      >
        <Reorder.Group
          axis="y"
          values={knowledgeIds}
          onReorder={setKnowledgeIds}
          className="flex w-full max-w-xl list-none flex-col gap-2"
        >
          {knowledgeIds.map((id, index) => {
            const entry = KNOWLEDGE_ENTRIES.find((candidate) => candidate.id === id)
            if (!entry) return null
            return (
              <KnowledgeEntryRow
                key={id}
                entry={entry}
                draggable={index === 0}
                onDragEnd={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            )
          })}
        </Reorder.Group>
        <Reorder.Group
          axis="y"
          values={[EDITED_ENTRY.id]}
          onReorder={() => {}}
          className="w-full max-w-xl list-none"
        >
          <KnowledgeEntryRow
            entry={EDITED_ENTRY}
            draggable
            onDragEnd={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
            editor={<Description withIcon={false}>Tu renderuje się edytor wpisu</Description>}
          />
        </Reorder.Group>
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">D. Kafelki statystyk</h3>
      <ShowcaseRow
        title="UserRegisterStats (moje kasy + saldo wszystkich)"
        source="dashboard/user-register-stats.tsx"
        className="items-start"
      >
        <div className="w-full max-w-xl">
          <UserRegisterStats cashRegisters={registers} showAllRegisters />
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="FinancialStats (bilans inwestora v1; marża tylko ADMIN/OWNER)"
        source="investments/financial-stats.tsx"
        className="items-start"
      >
        <div className="w-full max-w-3xl">
          <FinancialStats
            fields={FINANCIAL_FIELDS}
            margin={4180}
            totalPayouts={21680}
            settledFields={SETTLED_FIELDS}
          />
        </div>
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">E. Panel podsumowania</h3>
      <ShowcaseRow
        title="SummaryPanelContent — host inwestycji (bez marży: brak financials)"
        source="kosztorys/summary/summary-panel-content.tsx"
        className="items-start"
      >
        <div className="flex h-128 w-full max-w-3xl flex-col overflow-hidden rounded-md border">
          <SummaryPanelContent {...SUMMARY_PANEL_PROPS} host="investment" />
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="KosztorysTotalsPanel + KosztorysTotalsPanelToggle (wysuwany panel edytora)"
        source="kosztorys/summary/kosztorys-totals-panel.tsx, …-toggle.tsx"
        className="flex-col items-start"
      >
        <div className="flex gap-2">
          <KosztorysTotalsPanelToggle hasRows={false} />
          <KosztorysTotalsPanelToggle hasRows={false} disabled />
        </div>
        <div className="relative h-128 w-full max-w-3xl overflow-hidden rounded-md border">
          <KosztorysTotalsPanel
            {...SUMMARY_PANEL_PROPS}
            hasRows={false}
            availableHeight={TOTALS_PANEL_HEIGHT}
          />
        </div>
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
