'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { DateField, DescriptionField, SourceRegisterField } from '@/components/forms/form-fields'
import { useRegisterBalance } from '@/components/forms/hooks/use-register-balance'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import { settlePayoutsAction } from '@/lib/actions/settle-payouts'
import type { SettleRowT } from '@/lib/kosztorys/worker-payout-pairs'
import { warsawToday } from '@/lib/utils/days'
import { logError } from '@/lib/utils/log-error'
import { settleAction } from '@/lib/utils/settle-action'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import { formatPLN } from '@/lib/utils/format-currency'
import { toastMessage } from '@/lib/utils/toast'
import type { CashRegisterRefT } from '@/types/reference-data'
import { amountOf, isValidAmount, type RowValueT } from './row-value'
import { SettlePayoutsTable } from './settle-payouts-table'

type FormValuesT = {
  date: string
  sourceRegister: string
  description: string
  pool: string
  rows: RowValueT[]
}

// A nadpłata row starts unticked and empty: paying more into a pair already paid past its work is a
// deliberate zaliczka, never a default.
function prefill(rows: SettleRowT[]): RowValueT[] {
  return rows.map((row) =>
    row.state === 'payable'
      ? { ticked: true, amount: String(row.remaining) }
      : { ticked: false, amount: '' },
  )
}

type SettlePayoutsFormPropsT = {
  initialRows: SettleRowT[]
  /** Re-reads the rows after the action refused a batch built on figures that have since moved. */
  reloadRows: () => Promise<SettleRowT[]>
  cashRegisters: CashRegisterRefT[]
  defaultCashRegisterId: number | undefined
  defaultRegisterBalance: number | undefined
  /** Header of the label column — the other side of the pair from the dialog's target. */
  labelHeader: string
  /** Where a row's label leads, when the other side of the pair has a page worth checking. */
  labelHref?: (row: SettleRowT) => string
  onSubmitSuccess: () => void
}

/**
 * Awaits the action: a refusal here is routine (the figures moved while the dialog was open) and has
 * to land in the open dialog with the fresh figures, not in a toast after it closed.
 */
export function SettlePayoutsForm({
  initialRows,
  reloadRows,
  cashRegisters,
  defaultCashRegisterId,
  defaultRegisterBalance,
  labelHeader,
  labelHref,
  onSubmitSuccess,
}: SettlePayoutsFormPropsT) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const { registerBalance, isRegisterBalanceLoading, fetchRegisterBalance } =
    useRegisterBalance(defaultRegisterBalance)

  const form = useAppForm({
    defaultValues: {
      date: warsawToday(),
      sourceRegister: defaultCashRegisterId === undefined ? '' : String(defaultCashRegisterId),
      description: '',
      pool: '',
      rows: prefill(initialRows),
    } as FormValuesT,
    onSubmit: async ({ value }) => {
      if (!value.sourceRegister) {
        toastMessage('Wybierz kasę', 'error')
        return
      }
      const ticked = rows.flatMap((row, index) =>
        value.rows[index]?.ticked
          ? [
              {
                investmentId: row.investmentId,
                workerId: row.workerId,
                amount: roundToCents(amountOf(value.rows[index])),
                expectedRemaining: row.remaining,
              },
            ]
          : [],
      )

      const result = await settleAction(() =>
        settlePayoutsAction({
          date: value.date,
          sourceRegister: Number(value.sourceRegister),
          description: value.description,
          rows: ticked,
        }),
      )

      if (result.success) {
        toastMessage(
          ticked.length === 1 ? 'Wypłata zapisana' : `Zapisano ${ticked.length} wypłaty`,
          'success',
        )
        router.refresh()
        onSubmitSuccess()
        return
      }
      if ('stale' in result && result.stale) {
        toastMessage(result.error, 'warning', 5000)
        let fresh
        try {
          fresh = await reloadRows()
        } catch (err) {
          logError('[SETTLE_PAYOUTS_RELOAD]', err)
          toastMessage(
            'Nie udało się wczytać nowych kwot — zamknij okno i otwórz je ponownie.',
            'error',
            6000,
          )
          return
        }
        setRows(fresh)
        form.setFieldValue('rows', prefill(fresh))
        fetchRegisterBalance(form.getFieldValue('sourceRegister'))
        return
      }
      toastMessage(result.error, 'error', 6000)
    },
  })

  const rowValues = useStore(form.store, (state) => state.values.rows)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
  const tickedValues = rowValues.filter((value) => value.ticked)
  const total = roundToCents(
    tickedValues.reduce((sum, value) => sum + (isValidAmount(value) ? amountOf(value) : 0), 0),
  )
  const pool = parseDecimalInput(useStore(form.store, (state) => state.values.pool))
  const poolLeft = pool.kind === 'value' ? roundToCents(pool.value - total) : null
  const overPool = poolLeft !== null && poolLeft < 0
  const canSubmit = tickedValues.length > 0 && tickedValues.every(isValidAmount) && !overPool

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <SourceRegisterField
                form={form}
                cashRegisters={cashRegisters}
                registerBalance={registerBalance}
                isRegisterBalanceLoading={isRegisterBalanceLoading}
                fetchRegisterBalance={fetchRegisterBalance}
              />
              {registerBalance !== null && !isRegisterBalanceLoading && total > 0 && (
                <SignedMoneyDisplay amount={registerBalance - total} label="Saldo po wypłacie" />
              )}
            </div>
            <form.AppField name="pool">
              {(field) => (
                <field.Input
                  label="Do rozdysponowania"
                  placeholder="0.00"
                  type="number"
                  fieldClassName="w-44"
                />
              )}
            </form.AppField>
            <DateField form={form} fieldClassName="w-40" />
          </div>
          <DescriptionField form={form} placeholder="Opis wypłaty" />
        </FieldGroup>

        {rows.length === 0 ? (
          <p className="text-muted-foreground mt-6 text-sm">Brak wypłat do rozliczenia.</p>
        ) : (
          <SettlePayoutsTable
            className="mt-6"
            rows={rows}
            values={rowValues}
            total={total}
            poolLeft={poolLeft}
            labelHeader={labelHeader}
            labelHref={labelHref}
            onTick={(index, ticked) => form.setFieldValue(`rows[${index}].ticked`, ticked)}
            onAmount={(index, amount) => form.setFieldValue(`rows[${index}].amount`, amount)}
          />
        )}

        <footer className="mt-6 flex items-center gap-4">
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Zapisuję…' : 'Wypłać'}
          </Button>
          {overPool && (
            <p className="text-destructive text-sm">
              Przekroczono kwotę do rozdysponowania o {formatPLN(-poolLeft)}
            </p>
          )}
        </footer>
      </form>
    </form.AppForm>
  )
}
