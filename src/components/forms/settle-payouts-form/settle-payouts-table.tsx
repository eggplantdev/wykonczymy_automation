'use client'

import { createContext, use } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { OptionalLink } from '@/components/ui/optional-link'
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
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { amountOf, isValidAmount, type RowValueT } from './row-value'

type SettleTableContextT = {
  values: RowValueT[]
  onTick: (index: number, ticked: boolean) => void
  onAmount: (index: number, amount: string) => void
  labelHeader: string
  labelHref?: (row: SettleRowT) => string
}

// A context, not props on the columns: `flexRender` mounts a `cell` function as a component, so
// columns rebuilt per keystroke would remount the input under the caret. The columns stay
// module-level and the live values reach the cells here.
const SettleTableContext = createContext<SettleTableContextT | undefined>(undefined)

function useSettleTable() {
  const context = use(SettleTableContext)
  if (!context) throw new Error('useSettleTable must be used inside SettlePayoutsTable')
  return context
}

const EMPTY_VALUE: RowValueT = { ticked: false, amount: '' }

function useRowValue(index: number) {
  return useSettleTable().values[index] ?? EMPTY_VALUE
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
        <span className={cn(BADGE_BASE, BADGE_TONE.muted)}>{BLOCKED_TAG[state]}</span>
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
    // A new tab, so the dialog and its typed amounts survive the look.
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
        <p className="text-destructive mt-1 text-xs">
          {formatPLN(ahead)} ponad wykonaną pracę — zapisze się jako zaliczka
        </p>
      )}
    </>
  )
}

function AfterPayoutCell({ row, index }: { row: SettleRowT; index: number }) {
  const value = useRowValue(index)
  if (isBlocked(row.state)) return null
  if (!value.ticked || !isValidAmount(value))
    return <span className="text-muted-foreground">—</span>

  const after = roundToCents(row.remaining - amountOf(value))
  return (
    <span
      className={cn(
        'whitespace-nowrap',
        after === 0 && 'text-chart-green',
        after < 0 && 'text-destructive',
      )}
    >
      {formatPLN(after)}
    </span>
  )
}

const col = createColumnHelper<SettleRowT>()
const AMOUNT_COLUMN_ID = 'amount'

const money = (value: number) => <span className="whitespace-nowrap">{formatPLN(value)}</span>

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
    cell: (info) => money(info.getValue()),
  }),
  col.accessor('paid', {
    header: 'Wypłacone',
    meta: { align: 'right' },
    cell: (info) => money(info.getValue()),
  }),
  col.accessor('remaining', {
    header: 'Pozostało',
    meta: { align: 'right' },
    cell: (info) => (
      <span className={cn('whitespace-nowrap', info.getValue() < 0 && 'text-destructive')}>
        {formatPLN(info.getValue())}
      </span>
    ),
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
  className?: string
}

export function SettlePayoutsTable({
  rows,
  total,
  className,
  ...context
}: SettlePayoutsTablePropsT) {
  return (
    <SettleTableContext value={context}>
      <DataTable
        className={className}
        data={rows}
        columns={COLUMNS}
        getRowClassName={(row) => (isBlocked(row.state) ? 'opacity-60' : '')}
        footer={(visibleColumnIds) => (
          <ColumnTotalRow
            visibleColumnIds={visibleColumnIds}
            columnId={AMOUNT_COLUMN_ID}
            label="Razem"
          >
            {formatPLN(total)}
          </ColumnTotalRow>
        )}
      />
    </SettleTableContext>
  )
}
