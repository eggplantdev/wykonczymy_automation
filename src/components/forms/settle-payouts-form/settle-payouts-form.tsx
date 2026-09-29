'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import { useAppForm, useStore } from '@/components/forms/hooks/form-hooks'
import { CashRegisterField, DateField, DescriptionField } from '@/components/forms/form-fields'
import { settlePayoutsAction } from '@/lib/actions/settle-payouts'
import type { SettleRowT } from '@/lib/kosztorys/worker-payout-pairs'
import { warsawToday } from '@/lib/utils/days'
import { logError } from '@/lib/utils/log-error'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { toastMessage } from '@/lib/utils/toast'
import type { CashRegisterRefT } from '@/types/reference-data'
import { amountOf, isValidAmount, type RowValueT } from './row-value'
import { SettlePayoutsTable } from './settle-payouts-table'

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

type SettlePayoutsFormPropsT = {
  initialRows: SettleRowT[]
  /** Re-reads the rows after the action refused a batch built on figures that have since moved. */
  reloadRows: () => Promise<SettleRowT[]>
  cashRegisters: CashRegisterRefT[]
  defaultCashRegisterId: number | undefined
  /** Header of the label column — the other side of the pair from the dialog's target. */
  labelHeader: string
  /** Where a row's label leads, when the other side of the pair has a page worth checking. */
  labelHref?: (row: SettleRowT) => string
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
  labelHref,
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
          <SettlePayoutsTable
            className="mt-6"
            rows={rows}
            values={rowValues}
            total={total}
            labelHeader={labelHeader}
            labelHref={labelHref}
            onTick={(index, ticked) => form.setFieldValue(`rows[${index}].ticked`, ticked)}
            onAmount={(index, amount) => form.setFieldValue(`rows[${index}].amount`, amount)}
          />
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
