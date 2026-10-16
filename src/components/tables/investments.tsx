'use client'

import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { pluralize } from '@/lib/utils/polish-plural'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { isAdminOrOwnerRole, type RoleT } from '@/lib/auth/roles'
import { axisShows } from '@/lib/kosztorys/money-axis'
import { settlementModeLabel, settlementModeToMoneyAxis } from '@/lib/kosztorys/settlement-mode'
import { SUBCONTRACTOR_FIGURE_LABELS } from '@/lib/kosztorys/labels'
import type { InvestmentRowT } from '@/types/table-rows'
import { INVESTMENT_HEADER_TIPS } from '@/components/tables/investments-header-tips'
import { BalanceCell } from '@/components/ui/balance-cell'
import { Button } from '@/components/ui/button'
import { InvestmentStatusBadge } from '@/components/investments/investment-status-badge'
import { ContactLink } from '@/components/ui/contact-link'
import { LabelHintIcon } from '@/components/ui/label-hint-icon'
import { HintedValue } from '@/components/tables/hinted-value'
import { offPlaneDepositSentence } from '@/lib/kosztorys/off-plane-deposit-copy'
import { EditInvestmentDialog } from '@/components/dialogs/edit-investment-dialog'
import { TrashInvestmentButton } from '@/components/investments/trash-investment-button'
import { RequestReviewButton } from '@/components/investments/request-review-button'
import { isLockedStatus } from '@/lib/constants/investment-lock'
import { SheetButton } from '@/components/dialogs/sheet-button'
import { OpenKosztorysV2Button } from '@/components/kosztorys/open-kosztorys-v2-button'
import { AI_PROGRESS_STEPS } from '@/lib/constants/investment-ai-stage'
import { AiProgressBadge } from '@/components/investments/ai-progress-badge'

const col = createColumnHelper<InvestmentRowT>()

// Named here, beside the columns themselves, so the toolbar's „Pokaż kolumny v2" switch and the
// columns cannot drift apart.
export const V2_COLUMN_IDS = [
  'balance',
  'balanceGross',
  'marginV2',
  'laborCostsFromKosztorys',
  'subcontractorRemaining',
] as const

// Off `hasKosztorys` rather than `totalLaborCosts !== 0`, which cannot tell the two apart: a rozpiska
// entered in full but not yet started sums to zero.
function NoKosztorys() {
  return <span className="text-muted-foreground text-xs">brak kosztorysu</span>
}

// A row with an unsettled etap has no amount at all — zero would read as a real figure.
function UnsettledStages() {
  return <span className="text-muted-foreground text-xs">ustaw etapy</span>
}

function withheldFigureCell(info: CellContext<InvestmentRowT, number | undefined>) {
  const value = info.getValue()
  return value === undefined ? <UnsettledStages /> : <BalanceCell value={value} />
}

// A bilans brutto on an investment settled netto deducts only the przelewy and silently drops every
// wpłata gotówka.
function OtherSettlementMode({ row }: { row: InvestmentRowT }) {
  return (
    <span className="text-muted-foreground text-xs">
      rozliczenie {settlementModeLabel(row.settlementMode).toLowerCase()}
    </span>
  )
}

function settlesOn(row: InvestmentRowT, plane: 'net' | 'gross'): boolean {
  return axisShows(settlementModeToMoneyAxis(row.settlementMode))[plane]
}

// The balance is computed for every row whether or not the tryb builds it, so that cell would
// otherwise sort on a number the column refuses to print.
const balanceOrUndefined = (plane: 'net' | 'gross') => (row: InvestmentRowT) =>
  settlesOn(row, plane) ? row[plane === 'net' ? 'balance' : 'balanceGross'] : undefined

type InvestmentColumnOptionsT = {
  userRole: RoleT
  onSettle: (investment: InvestmentRowT) => void
}

export function getInvestmentColumns({ userRole, onSettle }: InvestmentColumnOptionsT) {
  const isAdminOrOwner = isAdminOrOwnerRole(userRole)
  return [
    col.accessor('name', {
      id: 'name',
      header: 'Nazwa',
      meta: { minWidth: 'min-w-56' },
    }),
    col.accessor('createdAt', {
      id: 'createdAt',
      header: 'Data dodania',
      sortDescFirst: true,
      cell: (info) => formatPLDate(info.getValue()),
    }),

    col.accessor('hasSheet', {
      id: 'hasSheet',
      header: 'Kosztorys',
      enableSorting: true,
      cell: (info) => (
        <SheetButton investmentId={info.row.original.id} hasSheet={!!info.getValue()} />
      ),
    }),
    col.display({
      id: 'kosztorysV2',
      header: 'Kosztorys_v2',
      cell: (info) => <OpenKosztorysV2Button investmentId={info.row.original.id} label="Otwórz" />,
    }),
    // The id stays `hasAiDraft`: it keys the column's stored visibility and order.
    col.accessor('aiProgress', {
      id: 'hasAiDraft',
      header: () => <span className="text-neon-cyan">Analiza AI</span>,
      meta: { label: 'Analiza AI' },
      enableSorting: true,
      sortingFn: (a, b) =>
        AI_PROGRESS_STEPS.indexOf(a.original.aiProgress) -
        AI_PROGRESS_STEPS.indexOf(b.original.aiProgress),
      cell: (info) => <AiProgressBadge step={info.getValue()} />,
    }),

    col.accessor('balanceFromTransactions', {
      id: 'balanceFromTransactions',
      header: 'Bilans netto v1',
      meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.balanceFromTransactions },
      cell: (info) => <BalanceCell value={info.getValue()} />,
    }),
    col.accessor(balanceOrUndefined('net'), {
      id: 'balance',
      sortUndefined: 'last',
      header: 'Bilans netto v2',
      meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.balance },
      cell: (info) => {
        if (!settlesOn(info.row.original, 'net'))
          return <OtherSettlementMode row={info.row.original} />
        return <BalanceCell value={info.row.original.balance} />
      },
    }),
    col.accessor(balanceOrUndefined('gross'), {
      id: 'balanceGross',
      sortUndefined: 'last',
      header: 'Bilans brutto v2',
      meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.balanceGross },
      cell: (info) => {
        const row = info.row.original
        if (!settlesOn(row, 'gross')) return <OtherSettlementMode row={row} />
        return (
          <HintedValue
            hint={
              row.strandedDeposits && (
                <LabelHintIcon
                  variant="strandedDeposits"
                  content={offPlaneDepositSentence(row.strandedDeposits, 'GROSS')}
                />
              )
            }
          >
            <BalanceCell value={row.balanceGross} />
          </HintedValue>
        )
      },
    }),
    ...(isAdminOrOwner
      ? [
          col.accessor('margin', {
            id: 'margin',
            header: 'Marża v1',
            meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.margin },
            cell: (info) => <BalanceCell value={info.getValue()} />,
          }),
          col.accessor('marginV2', {
            id: 'marginV2',
            // Without this the withheld rows go through the numeric comparator, which reads them as
            // 0 and scatters them among the genuine near-zero margins.
            sortUndefined: 'last',
            header: 'Marża v2',
            meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.marginV2 },
            cell: withheldFigureCell,
          }),
        ]
      : []),
    col.accessor('totalLaborCostsFromTransactions', {
      id: 'laborCostsFromTransactions',
      header: 'Robocizna v1',
      meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.laborCostsFromTransactions },
      cell: (info) => formatPLN(info.getValue()),
    }),
    col.accessor('totalLaborCosts', {
      id: 'laborCostsFromKosztorys',
      header: 'Robocizna v2',
      meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.laborCostsFromKosztorys },
      cell: (info) => {
        // Rounded: both sides are independent float folds, so a fully migrated investment lands a
        // sub-grosz residue apart rather than exactly equal, and the icon would never disappear.
        const gap = roundToCents(
          info.getValue() - info.row.original.totalLaborCostsFromTransactions,
        )
        return (
          <HintedValue
            hint={
              gap !== 0 && (
                <LabelHintIcon
                  variant="mismatch"
                  content={`Rozjazd z „Robocizna v1": ${formatPLN(gap)}. Tyle robocizny jest w kosztorysie ponad to, co zaksięgowano transferami — dodatnia kwota znaczy, że transfery są niedobite, ujemna, że praca nie jest jeszcze wpisana w kosztorys.`}
                />
              )
            }
          >
            {formatPLN(info.getValue())}
          </HintedValue>
        )
      },
    }),

    col.accessor('totalInvestmentExpense', {
      id: 'totalInvestmentExpense',
      header: 'Wydatki inwestycyjne',
      meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.totalInvestmentExpense },
      cell: (info) => <span className="font-medium">{formatPLN(info.getValue())}</span>,
    }),
    col.accessor('totalSettled', {
      id: 'totalSettled',
      header: 'Wydatki wliczone w robociznę',
      meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.totalSettled },
      cell: (info) => formatPLN(info.getValue()),
    }),
    ...(isAdminOrOwner
      ? [
          col.accessor('totalPayouts', {
            id: 'totalPayouts',
            header: 'Wypłaty',
            meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.totalPayouts },
            cell: (info) => formatPLN(info.getValue()),
          }),
        ]
      : []),
    col.accessor('subcontractorRemaining', {
      id: 'subcontractorRemaining',
      sortUndefined: 'last',
      header: SUBCONTRACTOR_FIGURE_LABELS.remaining,
      meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.subcontractorRemaining },
      cell: (info) => {
        const value = info.getValue()
        if (!info.row.original.hasKosztorys) return <NoKosztorys />
        if (value === undefined) return <UnsettledStages />
        const owedWorkers = info.row.original.subcontractorsOwed ?? 0
        return (
          <Button
            variant="link"
            className="h-auto flex-col items-end gap-0 p-0"
            onClick={() => onSettle(info.row.original)}
          >
            <BalanceCell
              value={value}
              className={roundToCents(value) === 0 ? 'text-chart-green' : undefined}
            />
            {owedWorkers > 1 && (
              <span className="text-muted-foreground text-xs font-normal">
                {owedWorkers} {pluralize(owedWorkers, ['pracownika', 'pracowników', 'pracowników'])}
              </span>
            )}
          </Button>
        )
      },
    }),
    col.accessor('address', {
      id: 'address',
      header: 'Adres',
      meta: { minWidth: 'min-w-56' },
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('phone', {
      id: 'phone',
      header: 'Telefon',
      meta: { minWidth: 'min-w-36' },
      cell: (info) => <ContactLink type="phone" value={info.getValue()} />,
    }),
    col.accessor('email', {
      id: 'email',
      header: 'Email',
      cell: (info) => <ContactLink type="email" value={info.getValue()} />,
    }),
    col.accessor('contactPerson', {
      id: 'contactPerson',
      header: 'Osoba kontaktowa',
      cell: (info) => info.getValue() || '—',
    }),
    col.accessor('reviewRequested', {
      id: 'reviewRequested',
      header: 'Opinia',
      cell: (info) => (info.getValue() ? 'Wysłano' : '—'),
    }),
    col.accessor('status', {
      id: 'status',
      header: 'Status',
      meta: { align: 'right' },
      enableSorting: true,
      cell: (info) => <InvestmentStatusBadge status={info.getValue()} />,
    }),
    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
      cell: (info) => (
        <div className="flex items-center justify-end gap-1">
          {isLockedStatus(info.row.original.status) && (
            <RequestReviewButton investment={info.row.original} />
          )}
          <EditInvestmentDialog investment={info.row.original} />
          <TrashInvestmentButton investment={info.row.original} />
        </div>
      ),
    }),
  ]
}
