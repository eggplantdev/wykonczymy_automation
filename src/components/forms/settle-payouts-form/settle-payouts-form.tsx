'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { CashRegisterField, DateField, DescriptionField } from '@/components/forms/form-fields'
import { settlePayoutsAction } from '@/lib/actions/settle-payouts'
import {
  BLOCKED_PAIR_REASON,
  BOOKABLE_STATES,
  paidAheadOf,
  type SettleRowT,
} from '@/lib/kosztorys/worker-payout-pairs'
import { cn } from '@/lib/utils/cn'
import { warsawToday } from '@/lib/utils/days'
import { formatPLN } from '@/lib/utils/format-currency'
import { logError } from '@/lib/utils/log-error'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { toastMessage } from '@/lib/utils/toast'
import type { CashRegisterRefT } from '@/types/reference-data'

type RowValueT = { ticked: boolean; amount: string }

type FormValuesT = {
  date: string
  sourceRegister: string
  description: string
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

const amountOf = (value: RowValueT) => Number(value.amount.replace(',', '.'))
const isValidAmount = (value: RowValueT) => amountOf(value) > 0

function AfterPayout({ remaining, amount }: { remaining: number; amount: number }) {
  const after = roundToCents(remaining - amount)
  if (after > 0) return <span>zostanie {formatPLN(after)}</span>
  if (after === 0) return <span className="text-chart-green">rozliczone</span>
  return <span className="text-destructive">nadpłata {formatPLN(-after)}</span>
}

type SettlePayoutsFormPropsT = {
  initialRows: SettleRowT[]
  /** Re-reads the rows after the action refused a batch built on figures that have since moved. */
  reloadRows: () => Promise<SettleRowT[]>
  cashRegisters: CashRegisterRefT[]
  defaultCashRegisterId: number | undefined
  /** Header of the label column — the other side of the pair from the dialog's target. */
  labelHeader: string
  onSubmitSuccess: () => void
}

/**
 * Awaits the action instead of the optimistic fire-and-forget every other transfer form uses: a
 * refusal here is routine (the figures moved while the dialog was open) and has to land in the open
 * dialog with the fresh figures, not in a toast after it closed.
 */
export function SettlePayoutsForm({
  initialRows,
  reloadRows,
  cashRegisters,
  defaultCashRegisterId,
  labelHeader,
  onSubmitSuccess,
}: SettlePayoutsFormPropsT) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)

  const form = useAppForm({
    defaultValues: {
      date: warsawToday(),
      sourceRegister: defaultCashRegisterId === undefined ? '' : String(defaultCashRegisterId),
      description: '',
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

      let result
      try {
        result = await settlePayoutsAction({
          date: value.date,
          sourceRegister: Number(value.sourceRegister),
          description: value.description,
          rows: ticked,
        })
      } catch (err) {
        logError('[SETTLE_PAYOUTS]', err)
        toastMessage('Wystąpił nieoczekiwany błąd', 'error', 5000)
        return
      }

      if (result.success) {
        toastMessage(
          ticked.length === 1 ? 'Wypłata zapisana' : `Zapisano ${ticked.length} wypłaty`,
          'success',
        )
        router.refresh()
        onSubmitSuccess()
        return
      }
      if (result.stale) {
        toastMessage(result.error, 'warning', 5000)
        const fresh = await reloadRows()
        setRows(fresh)
        form.setFieldValue('rows', prefill(fresh))
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
  const canSubmit = tickedValues.length > 0 && tickedValues.every(isValidAmount)

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
              <CashRegisterField form={form} name="sourceRegister" cashRegisters={cashRegisters} />
            </div>
            <DateField form={form} fieldClassName="w-40" />
          </div>
          <DescriptionField form={form} placeholder="Opis wypłaty" />
        </FieldGroup>

        {rows.length === 0 ? (
          <p className="text-muted-foreground mt-6 text-sm">Brak wypłat do rozliczenia.</p>
        ) : (
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="w-8" />
                <th className="py-1 font-medium">{labelHeader}</th>
                <th className="py-1 text-right font-medium">Pozostało</th>
                <th className="w-36 py-1 pl-4 font-medium">Kwota wypłaty</th>
                <th className="py-1 text-right font-medium">Po wypłacie</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const key = `${row.investmentId}:${row.workerId}`
                const bookable = BOOKABLE_STATES.has(row.state)
                const value = rowValues[index] ?? { ticked: false, amount: '' }
                const amount = isValidAmount(value) ? amountOf(value) : 0
                const ahead = value.ticked ? paidAheadOf(row.remaining, amount) : 0
                return (
                  <tr key={key} className={cn('border-t align-top', !bookable && 'opacity-60')}>
                    <td className="py-2">
                      <form.Field name={`rows[${index}].ticked`}>
                        {(field) => (
                          <Checkbox
                            aria-label={`Wypłać: ${row.label}`}
                            checked={field.state.value}
                            disabled={!bookable}
                            onCheckedChange={(checked) => field.handleChange(checked === true)}
                          />
                        )}
                      </form.Field>
                    </td>
                    <td className="py-2">{row.label}</td>
                    <td className={cn('py-2 text-right', row.remaining < 0 && 'text-destructive')}>
                      {formatPLN(row.remaining)}
                    </td>
                    {bookable ? (
                      <>
                        <td className="py-1 pl-4">
                          <form.Field name={`rows[${index}].amount`}>
                            {(field) => (
                              <Input
                                aria-label={`Kwota wypłaty: ${row.label}`}
                                inputMode="decimal"
                                value={field.state.value}
                                disabled={!value.ticked}
                                aria-invalid={value.ticked && !isValidAmount(value)}
                                onChange={(e) => field.handleChange(e.target.value)}
                              />
                            )}
                          </form.Field>
                          {ahead > 0 && (
                            <p className="text-destructive mt-1 text-xs">
                              {formatPLN(ahead)} ponad wykonaną pracę — zapisze się jako zaliczka
                            </p>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {value.ticked && isValidAmount(value) ? (
                            <AfterPayout remaining={row.remaining} amount={amount} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td colSpan={2} className="text-muted-foreground py-2 pl-4 text-xs">
                        {BLOCKED_PAIR_REASON[row.state as keyof typeof BLOCKED_PAIR_REASON]}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td />
                <td className="py-2" colSpan={2}>
                  Razem
                </td>
                <td className="py-2 pl-4">{formatPLN(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}

        <footer className="mt-6">
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Zapisuję…' : 'Wypłać'}
          </Button>
        </footer>
      </form>
    </form.AppForm>
  )
}
