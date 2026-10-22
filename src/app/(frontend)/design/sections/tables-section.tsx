'use client'

import { Description } from '@/components/ui/description'
import { useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { ColumnToggle } from '@/components/tables/data-table/column-toggle'
import { ColumnTotalRow } from '@/components/tables/data-table/column-total-row'
import {
  SelectedIdsContext,
  SelectPageHeader,
  SelectRowCell,
} from '@/components/tables/data-table/select-column'
import { getTransferColumns, transferRowClassName } from '@/components/tables/transfers'
import { getCashRegisterColumns } from '@/components/tables/cash-registers'
import { getUserColumns } from '@/components/tables/users'
import { TransferCardList } from '@/components/transfers/cards/transfer-card-list'
import { TransferViewSwitch } from '@/components/transfers/cards/transfer-view-switch'
import { ReviewLinesTable } from '@/components/kosztorys/editor/dialogs/worker-reports/review-lines-table'
import type { ReviewRowT } from '@/components/kosztorys/editor/dialogs/worker-reports/review-lines-table'
import type { LineDraftT } from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
import { WorkerSummary } from '@/components/kosztorys/worker-report/worker-summary'
import { ReportPreviewTable } from '@/components/worker-reports/report-preview-table'
import { WorkerReportHistoryTable } from '@/components/worker-reports/worker-report-history-table'
import { SettlePayoutsTable } from '@/components/forms/settle-payouts-form/settle-payouts-table'
import type { RowValueT } from '@/components/forms/settle-payouts-form/row-value'
import { HistoryChangesTable } from '@/components/kosztorys/editor/history/history-changes-table'
import { CataloguePickerTable } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-picker-table'
import { CatalogueDiffTable } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-diff-table'
import { InvestmentsWithoutSheetTable } from '@/components/sheets/investments-without-sheet-table'
import { WorkerExpenseDraftsTable } from '@/components/worker-expenses/worker-expense-drafts-table'
import {
  SUMMARY_NAME_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { useSearchFilter } from '@/hooks/use-search-filter'
import { formatPLN } from '@/lib/utils/format-currency'
import { toggleInSet } from '@/lib/utils/toggle-in-set'
import type { TransferViewT } from '@/lib/constants/transfer-view'
import type { TransferRowT } from '@/types/transfers'
import type { CashRegisterRowT, InvestmentWithoutSheetRowT, UserRowT } from '@/types/table-rows'
import type { WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'
import type { ReportPreviewLineT } from '@/lib/kosztorys/worker-report/types'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { SettleRowT } from '@/lib/kosztorys/worker-payout-pairs'
import type { ChangeRowT } from '@/lib/kosztorys/history/change-rows'
import type { CataloguePriceDiffT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'

type MaterialRowT = {
  id: number
  name: string
  category: string
  qty: number
  unit: string
  amount: number
}

const CATEGORIES = ['Chemia budowlana', 'Płytki', 'Hydraulika', 'Elektryka'] as const

const MATERIAL_ROWS: MaterialRowT[] = [
  {
    id: 1,
    name: 'Klej do płytek C2TE 25 kg',
    category: 'Chemia budowlana',
    qty: 12,
    unit: 'szt.',
    amount: 588,
  },
  { id: 2, name: 'Gres 60×60 szary mat', category: 'Płytki', qty: 34.5, unit: 'm²', amount: 4140 },
  { id: 3, name: 'Syfon podtynkowy', category: 'Hydraulika', qty: 2, unit: 'szt.', amount: 412.4 },
  { id: 4, name: 'Przewód YDYp 3×2,5', category: 'Elektryka', qty: 100, unit: 'mb', amount: 389 },
  {
    id: 5,
    name: 'Zwrot nadwyżki fug',
    category: 'Chemia budowlana',
    qty: 3,
    unit: 'szt.',
    amount: -96,
  },
]

const MANY_MATERIAL_ROWS: MaterialRowT[] = Array.from({ length: 200 }, (_, index) => ({
  id: index + 1,
  name: `Pozycja materiałowa ${index + 1}`,
  category: CATEGORIES[index % CATEGORIES.length],
  qty: (index % 9) + 1,
  unit: 'szt.',
  amount: ((index * 37) % 900) + 15,
}))

const MATERIAL_TOTAL = MATERIAL_ROWS.reduce((sum, row) => sum + row.amount, 0)

const materialColumn = createColumnHelper<MaterialRowT>()

const MATERIAL_COLUMNS = [
  materialColumn.accessor('name', {
    id: 'name',
    header: 'Nazwa',
    meta: { fill: true, minWidth: 'min-w-48' },
  }),
  materialColumn.accessor('category', {
    id: 'category',
    header: 'Kategoria',
    meta: { tooltip: 'Kategoria z cennika materiałów' },
  }),
  materialColumn.accessor('qty', {
    id: 'qty',
    header: 'Ilość',
    meta: { align: 'center', vertical: true, label: 'Ilość' },
    cell: (info) => `${info.getValue()} ${info.row.original.unit}`,
  }),
  materialColumn.accessor('amount', {
    id: 'amount',
    header: 'Kwota',
    meta: { align: 'right', description: 'netto', label: 'Kwota netto' },
    cell: (info) => formatPLN(info.getValue()),
  }),
]

const getMaterialText = (row: MaterialRowT) => `${row.name} ${row.category}`

function noop() {}

function fakeTransfer(overrides: Partial<TransferRowT> & Pick<TransferRowT, 'id'>): TransferRowT {
  return {
    description: 'Zakup materiałów',
    amount: 1250,
    netAmount: null,
    type: 'INVESTMENT_EXPENSE',
    paymentMethod: 'CASH',
    date: '2026-10-14',
    sourceRegisterId: 1,
    sourceRegisterName: 'Kasa główna',
    targetRegisterId: null,
    targetRegisterName: '—',
    sourceRegisterTrashed: false,
    targetRegisterTrashed: false,
    investmentId: 1,
    investmentName: 'Mokotów, ul. Przykładowa 1',
    expenseCategoryId: 1,
    expenseCategoryName: 'Materiały',
    otherCategoryName: '—',
    otherCategoryId: null,
    workerName: '—',
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
    vatPlane: 'NET',
    originalType: null,
    payoutStatus: null,
    payoutDecidedAt: null,
    payoutRejectionReason: null,
    orderStatus: null,
    ...overrides,
  }
}

const TRANSFER_ROWS: TransferRowT[] = [
  fakeTransfer({ id: 101 }),
  fakeTransfer({
    id: 102,
    type: 'INVESTOR_DEPOSIT',
    description: 'Zaliczka za etap 1',
    amount: 15000,
    paymentMethod: 'TRANSFER',
    vatPlane: 'GROSS',
    sourceRegisterId: null,
    sourceRegisterName: '—',
    targetRegisterId: 1,
    targetRegisterName: 'Kasa główna',
    expenseCategoryId: null,
    expenseCategoryName: '—',
  }),
  fakeTransfer({
    id: 103,
    type: 'PAYOUT',
    description: 'Wypłata za tydzień 41',
    amount: 2400,
    workerId: 7,
    workerName: 'Jan Przykładowy',
    expenseCategoryId: null,
    expenseCategoryName: '—',
    payoutStatus: 'pending',
  }),
  fakeTransfer({ id: 104, description: 'Pomyłka w kwocie', amount: 300, cancelled: true }),
  fakeTransfer({
    id: 105,
    type: 'CANCELLATION',
    description: 'Anulowanie #104',
    amount: -300,
    originalType: 'INVESTMENT_EXPENSE',
  }),
]

const CASH_REGISTER_ROWS: CashRegisterRowT[] = [
  {
    id: 1,
    name: 'Kasa główna',
    ownerName: 'Anna Testowa',
    balance: 18420.5,
    type: 'MAIN',
    active: true,
  },
  {
    id: 2,
    name: 'Kasa budowy',
    ownerName: 'Piotr Fikcyjny',
    balance: -350,
    type: 'AUXILIARY',
    active: true,
  },
  {
    id: 3,
    name: 'Kasa Jana',
    ownerName: 'Jan Przykładowy',
    balance: 0,
    type: 'WORKER',
    active: false,
  },
]

const USER_ROWS: UserRowT[] = [
  {
    id: 1,
    name: 'Anna Testowa',
    role: 'OWNER',
    email: 'anna@example.com',
    active: true,
    registerNames: ['Kasa główna'],
    canManage: false,
  },
  {
    id: 7,
    name: 'Jan Przykładowy',
    role: 'EMPLOYEE',
    email: 'jan@example.com',
    active: true,
    defaultCashRegisterName: 'Kasa Jana',
    registerNames: ['Kasa Jana'],
    canManage: true,
  },
  {
    id: 8,
    name: 'Ewa Zmyślona',
    role: 'MANAGER',
    email: 'ewa@example.com',
    active: false,
    registerNames: [],
    canManage: true,
  },
]

function fakeReviewRow(
  overrides: Partial<ReviewRowT> & Pick<ReviewRowT, 'id' | 'description'>,
): ReviewRowT {
  return {
    kind: 'rozpiska',
    itemId: overrides.id,
    unit: 'm²',
    reportedQty: 12,
    acceptedQty: undefined,
    isRejected: false,
    createdItemId: undefined,
    catalogueItemId: undefined,
    polishDescription: undefined,
    descriptionLanguage: 'pl',
    isUncertain: false,
    scannedRef: undefined,
    sectionName: 'Łazienka',
    sectionColor: 'blue-soft',
    sectionOrder: 1,
    ref: overrides.id,
    figures: { stageQty: 4, measuredQty: 10, plannedQty: 20, currentPlannedQty: 20 },
    itemDescription: undefined,
    workerDescription: undefined,
    workerDescriptionLanguage: undefined,
    isUnassigned: false,
    isAccepted: false,
    isFigureLive: true,
    isDuplicateItem: false,
    isUnitMissing: false,
    ...overrides,
  }
}

const REVIEW_ROWS: ReviewRowT[] = [
  fakeReviewRow({
    id: 11,
    description: 'Układanie płytek ściennych',
    workerDescription: 'Укладання настінної плитки',
    workerDescriptionLanguage: 'uk',
  }),
  fakeReviewRow({
    id: 12,
    description: 'Gruntowanie podłoża',
    reportedQty: 15,
    isUncertain: true,
  }),
  fakeReviewRow({
    id: 13,
    description: 'Montaż stelaża WC',
    unit: 'szt.',
    reportedQty: 1,
    sectionName: 'Kuchnia',
    sectionColor: 'turquoise-soft',
    sectionOrder: 2,
    figures: { stageQty: 0, measuredQty: 2, plannedQty: 1, currentPlannedQty: 1 },
  }),
]

const EXTRA_REVIEW_ROWS: ReviewRowT[] = [
  fakeReviewRow({
    id: 21,
    kind: 'extra',
    itemId: undefined,
    ref: undefined,
    figures: undefined,
    description: 'Dodatkowe skucie starej glazury',
    reportedQty: 6,
    descriptionLanguage: undefined,
  }),
]

const INITIAL_REVIEW_DRAFTS: Record<number, LineDraftT> = Object.fromEntries(
  [...REVIEW_ROWS, ...EXTRA_REVIEW_ROWS].map((row) => [
    row.id,
    {
      isTicked: row.id === 11,
      isRejected: false,
      qty: String(row.reportedQty),
      itemId: row.itemId,
      isExtra: row.kind === 'extra',
      catalogueId: undefined,
      matchedItemIds: [],
    },
  ]),
)

const REVIEW_ITEM_OPTIONS = REVIEW_ROWS.map((row) => ({
  value: String(row.id),
  label: row.description,
}))

const WORKER_SUMMARY: WorkerSummaryT = {
  plannedNet: 24000,
  executedByStage: [
    { stageId: 1, ordinal: 1, label: 'Wyburzenia', net: 3200, wholeNet: 3200, share: null },
    {
      stageId: 2,
      ordinal: 2,
      label: null,
      net: 4100,
      wholeNet: 8200,
      share: { percent: 50, amount: 4100 },
    },
  ],
  stagesWholeNet: 11400,
  executedNet: 7300,
  bonusNet: 500,
  payouts: [
    { date: '2026-10-03', amount: 3000, description: 'Wypłata za tydzień 40' },
    { date: '2026-10-10', amount: 2500, description: null },
  ],
  paidNet: 5500,
  owed: 2300,
  isOverpaid: false,
}

const REPORT_PREVIEW_LINES: ReportPreviewLineT[] = [
  {
    id: 1,
    kind: 'rozpiska',
    ref: 11,
    scannedRef: undefined,
    sectionName: 'Łazienka',
    sectionColor: 'blue-soft',
    description: 'Układanie płytek ściennych',
    workerDescription: undefined,
    workerDescriptionLanguage: undefined,
    unit: 'm²',
    reportedQty: 12,
    outcome: { kind: 'accepted', qty: 11.5 },
  },
  {
    id: 2,
    kind: 'rozpiska',
    ref: 12,
    scannedRef: undefined,
    sectionName: 'Łazienka',
    sectionColor: 'blue-soft',
    description: 'Gruntowanie podłoża',
    workerDescription: undefined,
    workerDescriptionLanguage: undefined,
    unit: 'm²',
    reportedQty: 15,
    outcome: { kind: 'pending' },
  },
  {
    id: 3,
    kind: 'rozpiska',
    ref: 13,
    scannedRef: undefined,
    sectionName: 'Kuchnia',
    sectionColor: 'turquoise-soft',
    description: 'Montaż stelaża WC',
    workerDescription: undefined,
    workerDescriptionLanguage: undefined,
    unit: 'szt.',
    reportedQty: 1,
    outcome: { kind: 'rejected' },
  },
]

const REPORT_LIST_ROWS: ReportListRowT[] = [
  {
    id: 1,
    investmentId: 1,
    investmentName: 'Mokotów, ul. Przykładowa 1',
    workerId: 7,
    workerName: 'Jan Przykładowy',
    status: 'pending',
    source: 'link',
    sentAt: '2026-10-15T16:00:00.000Z',
    decidedAt: null,
    decidedByName: null,
    lineCount: 6,
    acceptedLineCount: 0,
    rejectedLineCount: 0,
  },
  {
    id: 2,
    investmentId: 2,
    investmentName: 'Wilanów, ul. Zmyślona 5',
    workerId: 7,
    workerName: 'Jan Przykładowy',
    status: 'accepted',
    source: 'scan',
    sentAt: '2026-10-08T15:20:00.000Z',
    decidedAt: '2026-10-09T08:00:00.000Z',
    decidedByName: 'Anna Testowa',
    lineCount: 4,
    acceptedLineCount: 3,
    rejectedLineCount: 1,
  },
]

const EXPENSE_DRAFT_ROWS: ExpenseDraftRowT[] = [
  {
    id: 1,
    workerId: 7,
    workerName: 'Jan Przykładowy',
    investmentId: 1,
    investmentName: 'Mokotów, ul. Przykładowa 1',
    cashRegisterId: 3,
    note: 'Paragony z marketu',
    status: 'pending',
    sentAt: '2026-10-16T12:00:00.000Z',
    decidedAt: null,
    decidedByName: null,
    transfers: [],
    media: [],
    aiRead: undefined,
    acceptedReadRows: [],
    rejectedReceipts: [],
  },
  {
    id: 2,
    workerId: 7,
    workerName: 'Jan Przykładowy',
    investmentId: null,
    investmentName: null,
    cashRegisterId: 3,
    note: null,
    status: 'accepted',
    sentAt: '2026-10-02T10:00:00.000Z',
    decidedAt: '2026-10-03T09:00:00.000Z',
    decidedByName: 'Anna Testowa',
    transfers: [],
    media: [],
    aiRead: undefined,
    acceptedReadRows: [],
    rejectedReceipts: [],
  },
]

const SETTLE_ROWS: SettleRowT[] = [
  {
    investmentId: 1,
    workerId: 7,
    label: 'Mokotów, ul. Przykładowa 1',
    due: 7300,
    bonus: 500,
    paid: 5500,
    remaining: 2300,
    state: 'payable',
  },
  {
    investmentId: 2,
    workerId: 7,
    label: 'Wilanów, ul. Zmyślona 5',
    due: 4000,
    bonus: 0,
    paid: 4000,
    remaining: 0,
    state: 'settled',
  },
  {
    investmentId: 3,
    workerId: 7,
    label: 'Ursus, ul. Testowa 9',
    due: 1000,
    bonus: 0,
    paid: 1300,
    remaining: -300,
    state: 'overpaid',
  },
  {
    investmentId: 4,
    workerId: 7,
    label: 'Bemowo, ul. Wzorcowa 2',
    due: 2200,
    bonus: 0,
    paid: 0,
    remaining: 2200,
    state: 'withheld',
  },
]

const HISTORY_CHANGE_ROWS: ChangeRowT[] = [
  {
    sectionName: 'Łazienka',
    description: 'Układanie płytek ściennych',
    what: 'Przedmiar ofertowy',
    before: '18',
    after: '20',
  },
  {
    sectionName: 'Kuchnia',
    description: 'Montaż stelaża WC',
    what: 'Cena j.m.',
    before: '450,00 zł',
    after: '480,00 zł',
  },
  {
    sectionName: null,
    description: 'Rabat',
    what: 'Rabat',
    before: 'brak',
    after: '500,00 zł netto',
  },
]

const CATALOGUE_ITEMS: WorkCatalogueItemT[] = [
  {
    id: 1,
    description: 'Układanie płytek ściennych',
    descriptionTranslations: {},
    category: 'Glazura',
    unit: 'm²',
    clientPrice: 120,
    wToolsRate: 70,
    ownToolsRate: 60,
    wToolsRateCoeff: null,
    ownToolsRateCoeff: null,
    matchKey: 'plytki-scienne',
    workNote: null,
  },
  {
    id: 2,
    description: 'Gruntowanie podłoża',
    descriptionTranslations: {},
    category: 'Przygotowanie',
    unit: 'm²',
    clientPrice: 8,
    wToolsRate: null,
    ownToolsRate: null,
    wToolsRateCoeff: 0.5,
    ownToolsRateCoeff: 0.45,
    matchKey: 'gruntowanie',
    workNote: 'Dwie warstwy',
  },
  {
    id: 3,
    description: 'Montaż stelaża WC',
    descriptionTranslations: {},
    category: 'Hydraulika',
    unit: 'szt.',
    clientPrice: 480,
    wToolsRate: 250,
    ownToolsRate: 220,
    wToolsRateCoeff: null,
    ownToolsRateCoeff: null,
    matchKey: 'stelaz-wc',
    workNote: null,
  },
]

const CATALOGUE_DIFFS: CataloguePriceDiffT[] = [
  {
    itemId: 1,
    description: 'Układanie płytek ściennych',
    unit: 'm²',
    clientPrice: 120,
    maxDelta: 15,
    figures: [
      {
        label: 'Cena j.m.',
        field: 'clientPrice',
        kosztorys: 105,
        catalogue: 120,
        delta: 15,
        kosztorysSource: 'amount',
        catalogueSource: 'amount',
        kosztorysCoeff: null,
        catalogueCoeff: null,
      },
      {
        label: 'Stawka z narzędziami',
        field: 'wToolsRate',
        kosztorys: 65,
        catalogue: 70,
        delta: 5,
        kosztorysSource: 'amount',
        catalogueSource: 'amount',
        kosztorysCoeff: null,
        catalogueCoeff: null,
      },
    ],
  },
]

const SHEETLESS_INVESTMENT_ROWS: InvestmentWithoutSheetRowT[] = [
  { id: 'inv-5', investmentId: 5, name: 'Żoliborz, ul. Przykładowa 12' },
  { id: 'inv-6', investmentId: 6, name: 'Praga, ul. Fikcyjna 3' },
]

const TABLE_ROW_CLASS = 'block'

function ToolbarTableDemo() {
  const { filteredData, searchTerm, setSearchTerm } = useSearchFilter(
    MATERIAL_ROWS,
    getMaterialText,
  )
  return (
    <DataTable
      data={filteredData}
      columns={MATERIAL_COLUMNS}
      storageKey="design:table:toolbar"
      toolbar={({ table, columnVisibility, ...order }) => (
        <DataTableToolbar
          title="Materiały"
          search={{ value: searchTerm, onChange: setSearchTerm, placeholder: 'Szukaj materiału…' }}
          columns={<ColumnToggle table={table} columnVisibility={columnVisibility} {...order} />}
          actions={<Button size="sm">Dodaj</Button>}
        />
      )}
    />
  )
}

function SelectTableDemo() {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(() => new Set([2]))

  const toggleRow = (id: number) => setSelectedIds((previous) => toggleInSet(previous, id))
  const togglePage = (ids: number[]) =>
    setSelectedIds((previous) =>
      ids.every((id) => previous.has(id))
        ? new Set([...previous].filter((id) => !ids.includes(id)))
        : new Set([...previous, ...ids]),
    )

  const columns = [
    materialColumn.display({
      id: 'select',
      size: 40,
      enableHiding: false,
      header: ({ table }) => (
        <SelectPageHeader
          pageIds={table.getRowModel().rows.map((row) => row.original.id)}
          onTogglePage={togglePage}
        />
      ),
      cell: (info) => (
        <SelectRowCell
          id={info.row.original.id}
          label={`Zaznacz ${info.row.original.name}`}
          onToggle={toggleRow}
        />
      ),
    }),
    ...MATERIAL_COLUMNS,
  ]

  return (
    <SelectedIdsContext value={selectedIds}>
      <DataTable data={MATERIAL_ROWS} columns={columns} storageKey="design:table:select" />
      <Description size="xs" withIcon={false} className="mt-2">
        Zaznaczone: {selectedIds.size}
      </Description>
    </SelectedIdsContext>
  )
}

function TransferTableDemo() {
  const [view, setView] = useState<TransferViewT>('table')
  return (
    <DataTable
      data={TRANSFER_ROWS}
      columns={getTransferColumns()}
      storageKey="design:table:transfers"
      getRowClassName={transferRowClassName}
      renderRows={view === 'list' ? (rows) => <TransferCardList rows={rows} /> : undefined}
      toolbar={({ table, columnVisibility, ...order }) => (
        <DataTableToolbar
          title="Transakcje"
          columns={
            view === 'table' && (
              <ColumnToggle table={table} columnVisibility={columnVisibility} {...order} />
            )
          }
          actions={<TransferViewSwitch view={view} onChange={setView} />}
        />
      )}
    />
  )
}

function ReviewLinesDemo() {
  const [drafts, setDrafts] = useState(INITIAL_REVIEW_DRAFTS)
  const updateDraft = (lineId: number, patch: Partial<LineDraftT>) =>
    setDrafts((previous) => ({ ...previous, [lineId]: { ...previous[lineId], ...patch } }))

  const sharedProps = {
    drafts,
    onChange: updateDraft,
    itemOptions: REVIEW_ITEM_OPTIONS,
    catalogue: CATALOGUE_ITEMS,
    onOpenCatalogue: noop,
    onUndoSwap: noop,
    hintsByLine: {},
    stageTitle: 'Etap 2',
    onRetranslate: undefined,
    hasWorkerDescription: true,
  }

  return (
    <div className="worker-report flex flex-col gap-6">
      <ReviewLinesTable
        {...sharedProps}
        group="rozpiska"
        rows={REVIEW_ROWS}
        heading={<h4 className="text-sm font-semibold">Z rozpiski</h4>}
      />
      <ReviewLinesTable
        {...sharedProps}
        group="extra"
        rows={EXTRA_REVIEW_ROWS}
        heading={<h4 className="text-sm font-semibold">Spoza rozpiski</h4>}
      />
    </div>
  )
}

function SettlePayoutsDemo() {
  const [values, setValues] = useState<RowValueT[]>(() =>
    SETTLE_ROWS.map((row) => ({ ticked: row.state === 'payable', amount: String(row.remaining) })),
  )
  const patchValue = (index: number, patch: Partial<RowValueT>) =>
    setValues((previous) =>
      previous.map((value, position) => (position === index ? { ...value, ...patch } : value)),
    )
  const total = values.reduce(
    (sum, value) => (value.ticked ? sum + (Number(value.amount.replace(',', '.')) || 0) : sum),
    0,
  )

  return (
    <SettlePayoutsTable
      rows={SETTLE_ROWS}
      values={values}
      onTick={(index, ticked) => patchValue(index, { ticked })}
      onAmount={(index, amount) => patchValue(index, { amount })}
      isBooking={false}
      labelHeader="Inwestycja"
      total={total}
      poolLeft={5000 - total}
    />
  )
}

function CataloguePickerDemo() {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(() => new Set([1]))
  return (
    <CataloguePickerTable
      items={CATALOGUE_ITEMS}
      selectedIds={selectedIds}
      onToggle={(id) => setSelectedIds((previous) => toggleInSet(previous, id))}
    />
  )
}

export function TablesSection() {
  return (
    <ShowcaseSection id="tables">
      <h3 className="mt-4 text-xs font-semibold tracking-wide uppercase">
        A. DataTable — warianty (tables/data-table)
      </h3>
      <ShowcaseRow
        title="Zwykła tabela (meta: fill, minWidth, tooltip, vertical, description)"
        source="tables/data-table/data-table.tsx, tables/column-meta.ts"
        className={TABLE_ROW_CLASS}
      >
        <DataTable
          data={MATERIAL_ROWS}
          columns={MATERIAL_COLUMNS}
          storageKey="design:table:plain"
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="Z paskiem narzędzi — wyszukiwarka, kolumny (+ kolejność, rozmiar tekstu), akcje"
        source="tables/data-table/data-table-toolbar.tsx, column-toggle.tsx, text-size-menu-section.tsx"
        className={TABLE_ROW_CLASS}
      >
        <ToolbarTableDemo />
      </ShowcaseRow>
      <ShowcaseRow
        title="Sortowanie startowe (Kwota malejąco) — kliknij nagłówek, Shift = wiele kluczy"
        source="DataTable initialSorting"
        className={TABLE_ROW_CLASS}
      >
        <DataTable
          data={MATERIAL_ROWS}
          columns={MATERIAL_COLUMNS}
          storageKey="design:table:sorted"
          initialSorting={[{ id: 'amount', desc: true }]}
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="Wiersz jako link + klasa wiersza (ujemna kwota podświetlona)"
        source="DataTable getRowHref, getRowClassName"
        className={TABLE_ROW_CLASS}
      >
        <DataTable
          data={MATERIAL_ROWS}
          columns={MATERIAL_COLUMNS}
          storageKey="design:table:href"
          getRowHref={() => '#tables'}
          getRowClassName={(row) => (row.amount < 0 ? 'bg-destructive/5' : '')}
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="Stopka z sumą kolumny"
        source="tables/data-table/table-footer.tsx, column-total-row.tsx"
        className={TABLE_ROW_CLASS}
      >
        <DataTable
          data={MATERIAL_ROWS}
          columns={MATERIAL_COLUMNS}
          storageKey="design:table:footer"
          footer={(visibleColumnIds) => (
            <ColumnTotalRow visibleColumnIds={visibleColumnIds} columnId="amount" label="Razem">
              {formatPLN(MATERIAL_TOTAL)}
            </ColumnTotalRow>
          )}
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="Brak danych"
        source="tables/data-table/empty-row.tsx"
        className={TABLE_ROW_CLASS}
      >
        <DataTable data={[]} columns={MATERIAL_COLUMNS} storageKey="design:table:empty" />
      </ShowcaseRow>
      <ShowcaseRow
        title="Kolumna zaznaczania (strona + wiersz)"
        source="tables/data-table/select-column.tsx"
        className={TABLE_ROW_CLASS}
      >
        <SelectTableDemo />
      </ShowcaseRow>
      <ShowcaseRow
        title="Wirtualizowana — 200 wierszy, przewijany kontener"
        source="tables/data-table/virtualized-table-body.tsx"
        className={TABLE_ROW_CLASS}
      >
        <DataTable
          data={MANY_MATERIAL_ROWS}
          columns={MATERIAL_COLUMNS}
          storageKey="design:table:virtual"
          enableVirtualization
          virtualContainerHeight={320}
        />
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        B. Kolumny domenowe na DataTable
      </h3>
      <ShowcaseRow
        title="Transakcje — tabela / karty (przełącznik widoku), anulowana i anulowanie"
        source="tables/transfers.tsx, transfers/cards/transfer-card-list.tsx, transfer-view-switch.tsx"
        className={TABLE_ROW_CLASS}
      >
        <TransferTableDemo />
      </ShowcaseRow>
      <ShowcaseRow
        title="Transakcje — widok kart (stos)"
        source="transfers/cards/transfer-card-list.tsx, transfer-card.tsx"
        className={TABLE_ROW_CLASS}
      >
        <DataTable
          data={TRANSFER_ROWS}
          columns={getTransferColumns()}
          renderRows={(rows) => <TransferCardList rows={rows} />}
        />
      </ShowcaseRow>
      <ShowcaseRow title="Kasy" source="tables/cash-registers.tsx" className={TABLE_ROW_CLASS}>
        <DataTable
          data={CASH_REGISTER_ROWS}
          columns={getCashRegisterColumns(noop, () => true)}
          storageKey="design:table:cash-registers"
        />
      </ShowcaseRow>
      <ShowcaseRow title="Pracownicy" source="tables/users.tsx" className={TABLE_ROW_CLASS}>
        <DataTable
          data={USER_ROWS}
          columns={getUserColumns({ onToggle: noop, onSettle: noop })}
          storageKey="design:table:users"
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="Inwestycje bez arkusza (wyszukiwarka + kolumny)"
        source="sheets/investments-without-sheet-table.tsx"
        className={TABLE_ROW_CLASS}
      >
        <InvestmentsWithoutSheetTable data={SHEETLESS_INVESTMENT_ROWS} />
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        C. Zgłoszenia pracy i wydatki pracowników
      </h3>
      <ShowcaseRow
        title="Akceptacja godzin / zgłoszenia — z rozpiski i spoza rozpiski"
        source="kosztorys/editor/dialogs/worker-reports/review-lines-table.tsx"
        className={TABLE_ROW_CLASS}
      >
        <ReviewLinesDemo />
      </ShowcaseRow>
      <ShowcaseRow
        title="Podgląd zgłoszenia (przyjęte / czeka / odrzucone)"
        source="worker-reports/report-preview-table.tsx"
        className={TABLE_ROW_CLASS}
      >
        <div className="worker-report">
          <ReportPreviewTable group="rozpiska" lines={REPORT_PREVIEW_LINES} />
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="Historia zgłoszeń (filtry statusu i inwestycji + paginacja)"
        source="worker-reports/worker-report-history-table.tsx"
        className={TABLE_ROW_CLASS}
      >
        <WorkerReportHistoryTable reports={REPORT_LIST_ROWS} canOpenInKosztorys={false} />
      </ShowcaseRow>
      <ShowcaseRow
        title="Wydatki pracownika (widok pracownika)"
        source="worker-expenses/worker-expense-drafts-table.tsx"
        className={TABLE_ROW_CLASS}
      >
        <WorkerExpenseDraftsTable
          drafts={EXPENSE_DRAFT_ROWS}
          canSend={false}
          canOpenTransfers={false}
        />
      </ShowcaseRow>
      <ShowcaseRow
        title="Podsumowanie pracownika (strona raportu)"
        source="kosztorys/worker-report/worker-summary.tsx"
        className={TABLE_ROW_CLASS}
      >
        <WorkerSummary summary={WORKER_SUMMARY} />
      </ShowcaseRow>

      <h3 className="mt-6 text-xs font-semibold tracking-wide uppercase">
        D. Rozliczenia, kosztorys i katalog
      </h3>
      <ShowcaseRow
        title="Rozlicz wypłaty (zaznaczanie, kwoty, stopka z sumą i pulą)"
        source="forms/settle-payouts-form/settle-payouts-table.tsx"
        className={TABLE_ROW_CLASS}
      >
        <SettlePayoutsDemo />
      </ShowcaseRow>
      <ShowcaseRow
        title="SummaryTable — wiele kolumn wartości, wagi, tony, notatki, podpowiedzi"
        source="ui/summary-grid.tsx"
        className={TABLE_ROW_CLASS}
      >
        <SummaryTable
          cols={`${SUMMARY_NAME_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`}
          className="w-fit"
        >
          <SummaryHeaderCell variant="label">Etap</SummaryHeaderCell>
          <SummaryHeaderCell>Oferta</SummaryHeaderCell>
          <SummaryHeaderCell>Wykonano</SummaryHeaderCell>
          <SummaryHeaderCell muted>Wypłacono</SummaryHeaderCell>
          <SummaryLabelCell>Wyburzenia</SummaryLabelCell>
          <SummaryValueCell>6 000,00 zł</SummaryValueCell>
          <SummaryValueCell tone="success">6 000,00 zł</SummaryValueCell>
          <SummaryValueCell muted>3 200,00 zł</SummaryValueCell>
          <SummaryLabelCell
            hints={[{ variant: 'planeUnconfirmed', content: 'Etap bez ustawionego rozliczenia' }]}
          >
            Glazura
          </SummaryLabelCell>
          <SummaryValueCell>12 000,00 zł</SummaryValueCell>
          <SummaryValueCell note={{ text: '68% oferty' }}>8 200,00 zł</SummaryValueCell>
          <SummaryValueCell tone="error" note={{ text: 'nadpłata', tone: 'error' }}>
            -300,00 zł
          </SummaryValueCell>
          <SummaryLabelCell weight="medium">Razem netto</SummaryLabelCell>
          <SummaryValueCell weight="medium">18 000,00 zł</SummaryValueCell>
          <SummaryValueCell weight="medium">14 200,00 zł</SummaryValueCell>
          <SummaryValueCell weight="medium">2 900,00 zł</SummaryValueCell>
          <SummaryLabelCell weight="bold">Do wypłaty</SummaryLabelCell>
          <SummaryValueCell weight="bold">—</SummaryValueCell>
          <SummaryValueCell weight="bold" tone="success">
            11 300,00 zł
          </SummaryValueCell>
          <SummaryValueCell weight="bold">—</SummaryValueCell>
        </SummaryTable>
      </ShowcaseRow>
      <ShowcaseRow
        title="Historia zmian kosztorysu (było / jest)"
        source="kosztorys/editor/history/history-changes-table.tsx"
        className={TABLE_ROW_CLASS}
      >
        <HistoryChangesTable rows={HISTORY_CHANGE_ROWS} />
      </ShowcaseRow>
      <ShowcaseRow
        title="Wybór z katalogu prac (zaznaczanie, wirtualizacja)"
        source="kosztorys/editor/dialogs/catalogue/catalogue-picker-table.tsx"
        className={TABLE_ROW_CLASS}
      >
        <CataloguePickerDemo />
      </ShowcaseRow>
      <ShowcaseRow
        title="Różnice cen kosztorys ↔ katalog"
        source="kosztorys/editor/dialogs/catalogue/catalogue-diff-table.tsx"
        className={TABLE_ROW_CLASS}
      >
        <CatalogueDiffTable
          diffs={CATALOGUE_DIFFS}
          readOnly={false}
          onApply={() => true}
          onEditInCatalogue={noop}
        />
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
