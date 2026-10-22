'use client'

import { createContext, use } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { OptionalLink } from '@/components/ui/optional-link'
import { BalanceCell } from '@/components/ui/balance-cell'
import { DataTable } from '@/components/tables/data-table/data-table'
import { ColumnTotalRow } from '@/components/tables/data-table/column-total-row'
import { InvestmentStatusBadge } from '@/components/investments/investment-status-badge'
import {
  BLOCKED_PAIR_REASON,
  isBlocked,
  paidAheadOf,
  type BlockedStateT,
  type SettleRowT,
} from '@/lib/kosztorys/worker-payout-pairs'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { formatPLN, formatPLNOrDash } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { amountOf, isValidAmount, type RowValueT } from './row-value'
import { EMPTY_VALUE } from '@/lib/utils/empty-value'

type SettleTableContextT = {
  values: RowValueT[]
  onTick: (index: number, ticked: boolean) => void
  onAmount: (index: number, amount: string) => void
  onBonus?: (index: number) => void
  isBooking: boolean
  labelHeader: string
  labelHref?: (row: SettleRowT) => string
}

// `flexRender` mounts a `cell` function as a component, so columns rebuilt per keystroke would
// remount the input under the caret.
const SettleTableContext = createContext<SettleTableContextT | undefined>(undefined)

function useSettleTable() {
  const context = use(SettleTableContext)
  if (!context) throw new Error('useSettleTable must be used inside SettlePayoutsTable')
  return context
}

const EMPTY_ROW_VALUE: RowValueT = { ticked: false, amount: '' }

function useRowValue(index: number) {
  return useSettleTable().values[index] ?? EMPTY_ROW_VALUE
}

const BLOCKED_TAG: Record<Exclude<BlockedStateT, 'locked'>, string> = {
  withheld: 'Bez rozliczenia',
  unassigned: 'Bez pracownika',
}

function BlockedReason({ state }: { state: BlockedStateT }) {
  const reason = BLOCKED_PAIR_REASON[state]
  return (
    <span className="inline-flex items-center gap-1">
      {state === 'locked' ? (
        <InvestmentStatusBadge status={LOCKED_INVESTMENT_STATUS} />
      ) : (
        <Badge tone="muted">{BLOCKED_TAG[state]}</Badge>
      )}
      <InfoTooltip content={reason} label={reason} />
    </span>
  )
}

function LabelHeader() {
  return useSettleTable().labelHeader
}

function LabelCell({ row }: { row: SettleRowT }) {
  const { labelHref } = useSettleTable()
  return (
    <OptionalLink href={labelHref?.(row)} target="_blank" className="underline-offset-4">
      {row.label}
    </OptionalLink>
  )
}

function TickCell({ row, index }: { row: SettleRowT; index: number }) {
  const { onTick } = useSettleTable()
  const value = useRowValue(index)
  return (
    <Checkbox
      aria-label={`Wypłać: ${row.label}`}
      checked={value.ticked}
      disabled={isBlocked(row.state)}
      onCheckedChange={(checked) => onTick(index, checked === true)}
    />
  )
}

function AmountCell({ row, index }: { row: SettleRowT; index: number }) {
  const { onAmount } = useSettleTable()
  const value = useRowValue(index)
  if (isBlocked(row.state)) return <BlockedReason state={row.state} />

  const ahead =
    value.ticked && isValidAmount(value) ? paidAheadOf(row.remaining, amountOf(value)) : 0
  return (
    <>
      <Input
        aria-label={`Kwota wypłaty: ${row.label}`}
        inputMode="decimal"
        value={value.amount}
        disabled={!value.ticked}
        aria-invalid={value.ticked && !isValidAmount(value)}
        onChange={(e) => onAmount(index, e.target.value)}
      />
      {ahead > 0 && (
        <Description tone="error" size="xs" className="mt-1">
          {formatPLN(ahead)} ponad wykonaną pracę — zapisze się jako zaliczka
        </Description>
      )}
    </>
  )
}

function AfterPayoutCell({ row, index }: { row: SettleRowT; index: number }) {
  const { onBonus, isBooking } = useSettleTable()
  const value = useRowValue(index)
  if (isBlocked(row.state)) return null
  if (onBonus && row.state === 'overpaid' && !value.ticked) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isBooking}
        onClick={() => onBonus(index)}
      >
        Wyrównaj premią
      </Button>
    )
  }
  if (!value.ticked || !isValidAmount(value)) return EMPTY_VALUE

  return <RemainderAmount value={roundToCents(row.remaining - amountOf(value))} />
}

function RemainderAmount({ value }: { value: number }) {
  return <BalanceCell value={value} settled />
}

const col = createColumnHelper<SettleRowT>()
const AMOUNT_COLUMN_ID = 'amount'
const BONUS_COLUMN_ID = 'bonus'

const COLUMNS = [
  col.display({
    id: 'ticked',
    header: '',
    cell: ({ row }) => <TickCell row={row.original} index={row.index} />,
  }),
  col.accessor('label', {
    header: () => <LabelHeader />,
    cell: ({ row }) => <LabelCell row={row.original} />,
  }),
  col.accessor('due', {
    header: 'Wykonane',
    meta: { align: 'right' },
    cell: (info) => formatPLNOrDash(info.getValue()),
  }),
  col.accessor('bonus', {
    id: BONUS_COLUMN_ID,
    header: 'Premia',
    meta: { align: 'right' },
    cell: (info) => formatPLNOrDash(info.getValue()),
  }),
  col.accessor('paid', {
    header: 'Wypłacone',
    meta: { align: 'right' },
    cell: (info) => formatPLNOrDash(info.getValue()),
  }),
  col.accessor('remaining', {
    header: 'Pozostało',
    meta: { align: 'right' },
    cell: (info) => <BalanceCell value={info.getValue()} />,
  }),
  col.display({
    id: AMOUNT_COLUMN_ID,
    header: 'Kwota wypłaty',
    meta: { minWidth: 'min-w-36' },
    cell: ({ row }) => <AmountCell row={row.original} index={row.index} />,
  }),
  col.display({
    id: 'after',
    header: 'Pozostało do rozliczenia',
    meta: { align: 'right' },
    cell: ({ row }) => <AfterPayoutCell row={row.original} index={row.index} />,
  }),
]

type SettlePayoutsTablePropsT = SettleTableContextT & {
  rows: SettleRowT[]
  total: number
  poolLeft: number | null
  className?: string
}

export function SettlePayoutsTable({
  rows,
  total,
  poolLeft,
  className,
  ...context
}: SettlePayoutsTablePropsT) {
  return (
    <SettleTableContext value={context}>
      <DataTable
        className={className}
        data={rows}
        columns={COLUMNS}
        defaultColumnVisibility={{ [BONUS_COLUMN_ID]: rows.some((row) => row.bonus !== 0) }}
        getRowClassName={(row) => (isBlocked(row.state) ? 'opacity-60' : '')}
        footer={(visibleColumnIds) => (
          <>
            <ColumnTotalRow
              visibleColumnIds={visibleColumnIds}
              columnId={AMOUNT_COLUMN_ID}
              label="Razem"
            >
              {formatPLN(total)}
            </ColumnTotalRow>
            {poolLeft !== null && (
              <ColumnTotalRow
                visibleColumnIds={visibleColumnIds}
                columnId={AMOUNT_COLUMN_ID}
                label="Zostało do rozdysponowania"
              >
                <RemainderAmount value={poolLeft} />
              </ColumnTotalRow>
            )}
          </>
        )}
      />
    </SettleTableContext>
  )
}
