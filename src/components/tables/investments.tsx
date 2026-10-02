'use client'

import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import { pluralize } from '@/lib/utils/polish-plural'
import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { isAdminOrOwnerRole, type RoleT } from '@/lib/auth/roles'
import { axisShows } from '@/lib/kosztorys/money-axis'
import { settlementModeToMoneyAxis } from '@/lib/kosztorys/settlement-mode'
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

const col = createColumnHelper<InvestmentRowT>()

// The kosztorys-sourced half of every doubled figure, plus „Pozostało do wypłaty", which has no v1
// twin but reads the kosztorys all the same. Named here, beside the columns themselves, so
// the toolbar's „Pokaż kolumny v2" switch and the columns cannot drift apart — and so EX-712, which
// deletes the v1/v2 split once the rozjazd is zero everywhere, has one list to delete.
export const V2_COLUMN_IDS = [
  'balance',
  'balanceGross',
  'marginV2',
  'laborCostsFromKosztorys',
  'subcontractorRemaining',
] as const

// An investment whose kosztorys is empty reads zero robocizna, and every other v2 figure is built on
// that zero: the bilans then says the client owes nothing for work that was done, and the marża that
// the crews cost nothing. All of them say „brak danych" instead — the kosztorys is the source, so
// „nothing entered" is the honest reading, and the number returns the moment it is.
//
// Off `hasKosztorys` rather than `totalLaborCosts !== 0`, which cannot tell the two apart: „pomiar z
// natury" is the etap sum, so a rozpiska entered in full but not yet started sums to zero and would
// be withheld as „nothing entered" — over real data, and with the v1/v2 rozjazd icon suppressed
// exactly where a fresh kosztorys most needs it flagged.
function hasKosztorysReading(row: InvestmentRowT): boolean {
  return row.hasKosztorys
}

function NoKosztorysData() {
  return <span className="text-muted-foreground text-xs">brak danych</span>
}

// A row with an unsettled etap has no amount at all — zero would read as a real figure: a crew
// working for free on the marża, a crew paid in full on „Pozostało do wypłaty".
function UnsettledStages() {
  return <span className="text-muted-foreground text-xs">ustaw etapy</span>
}

function withheldFigureCell(info: CellContext<InvestmentRowT, number | undefined>) {
  const value = info.getValue()
  if (!hasKosztorysReading(info.row.original)) return <NoKosztorysData />
  return value === undefined ? <UnsettledStages /> : <BalanceCell value={value} />
}

// The tryb decides which bilans EXISTS — one column per investment, never two (owner, 2026-08-23).
// The other one isn't merely uninteresting, it is unbuilt: since nothing is derived at VAT, a bilans
// brutto on an investment settled netto deducts only the przelewy and silently drops every wpłata
// gotówka. The same projection the Podsumowanie panel reads, so the listing can never print a kwota
// the panel refuses to show.
function NotApplicable() {
  return <span className="text-muted-foreground text-xs">nie dotyczy</span>
}

function settlesOn(row: InvestmentRowT, plane: 'net' | 'gross'): boolean {
  return axisShows(settlementModeToMoneyAxis(row.settlementMode))[plane]
}

// Withheld cells sort last instead of by the figure behind them. The balance is computed for every
// row whether or not the tryb builds it, so a „nie dotyczy" would otherwise sort on a number the
// column refuses to print — same reason `marginV2` carries `sortUndefined` below.
const balanceOrUndefined = (plane: 'net' | 'gross') => (row: InvestmentRowT) =>
  settlesOn(row, plane) && hasKosztorysReading(row)
    ? row[plane === 'net' ? 'balance' : 'balanceGross']
    : undefined

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

    // Every figure that exists on two planes is shown on BOTH, v1 beside v2: nothing here infers
    // which plane an investment „really" belongs to, because while investments are still being moved
    // off the spreadsheets one legitimately carries figures on both. Hide what you are not comparing
    // today with the column picker.
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
        if (!settlesOn(info.row.original, 'net')) return <NotApplicable />
        if (!hasKosztorysReading(info.row.original)) return <NoKosztorysData />
        return <BalanceCell value={info.row.original.balance} />
      },
    }),
    // No v1 twin: brutto has only ever been computed on the plane its netto came from.
    col.accessor(balanceOrUndefined('gross'), {
      id: 'balanceGross',
      sortUndefined: 'last',
      header: 'Bilans brutto v2',
      meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.balanceGross },
      cell: (info) => {
        const row = info.row.original
        if (!settlesOn(row, 'gross')) return <NotApplicable />
        if (!hasKosztorysReading(row)) return <NoKosztorysData />
        return (
          <HintedValue
            /* Whatever this figure drops, said out loud — the Podsumowanie panel says the same
               sentence about the same wpłaty, and a bare number here contradicted it. The tryb is
               brutto by the time a row carries these, which is the only tryb that strands any. */
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
    // The transition's work queue: the two planes side by side on the figure they actually disagree
    // about. Zero rozjazd everywhere means the move is done and both columns can go.
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
      // The rozjazd rides on this cell rather than a column of its own: as a column it was a bare
      // number under a header nobody could decode, and it is only ever read against the v2 amount
      // standing next to it.
      cell: (info) => {
        if (!hasKosztorysReading(info.row.original)) return <NoKosztorysData />
        // Rounded: both sides are independent float folds, so a fully migrated investment lands a
        // sub-grosz residue apart rather than exactly equal, and the icon would never disappear.
        const gap = roundToCents(
          info.getValue() - info.row.original.totalLaborCostsFromTransactions,
        )
        return (
          <HintedValue
            /* No icon at zero — „nothing left to move" is the answer that needs no explanation. */
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
    // Wypłaty (payouts) is admin/owner-only, matching the detail page where it
    // sits alongside Marża behind the same role gate.
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
    // Ungated, unlike „Wypłaty" beside it: the owner wants every management role to see where a
    // crew is still owed money.
    col.accessor('subcontractorRemaining', {
      id: 'subcontractorRemaining',
      sortUndefined: 'last',
      header: SUBCONTRACTOR_FIGURE_LABELS.remaining,
      meta: { align: 'right', tooltip: INVESTMENT_HEADER_TIPS.subcontractorRemaining },
      cell: (info) => {
        const value = info.getValue()
        if (value === undefined || !hasKosztorysReading(info.row.original)) {
          return withheldFigureCell(info)
        }
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
          {/* Also mounted for the edit dialog's post-save prompt, which opens it by id. */}
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
