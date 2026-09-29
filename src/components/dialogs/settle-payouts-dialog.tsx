'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { SettlePayoutsForm } from '@/components/forms/settle-payouts-form/settle-payouts-form'
import {
  fetchSettlePayoutRows,
  type SettlePayoutRowsT,
  type SettleTargetT,
} from '@/lib/queries/settle-payouts'
import { logError } from '@/lib/utils/log-error'

export type SettleDialogTargetT = SettleTargetT & { name: string }

type SettlePayoutsDialogPropsT = {
  target: SettleDialogTargetT | null
  onClose: () => void
}

/**
 * One instance per table, opened with the row that was clicked. Controlled rather than `FormDialog`,
 * whose trigger-per-instance model would mount one dialog per table row.
 */
export function SettlePayoutsDialog({ target, onClose }: SettlePayoutsDialogPropsT) {
  // Keyed by target so a result that lands for a row no longer open is never shown for another.
  const [loaded, setLoaded] = useState<{
    key: string
    data?: SettlePayoutRowsT
    error?: string
  } | null>(null)
  const targetKey = target ? `${target.kind}:${target.id}` : null

  useEffect(() => {
    if (!target) return
    const key = `${target.kind}:${target.id}`
    let cancelled = false
    fetchSettlePayoutRows({ kind: target.kind, id: target.id })
      .then((data) => {
        if (!cancelled) setLoaded({ key, data })
      })
      .catch((err) => {
        logError('[SETTLE_PAYOUTS_LOAD]', err)
        if (!cancelled) setLoaded({ key, error: 'Nie udało się wczytać kwot' })
      })
    return () => {
      cancelled = true
    }
  }, [target])

  const current = loaded?.key === targetKey ? loaded : null
  const data = current?.data
  const error = current?.error
  // Dropped on close so a reopen after a booking never shows the figures from before it.
  const close = () => {
    setLoaded(null)
    onClose()
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader title={target ? `Rozlicz wypłaty — ${target.name}` : 'Rozlicz wypłaty'} />
        <div className="mt-6 pr-1">
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : !data || !target ? (
            <div className="flex h-40 items-center justify-center">
              <GradientSpinner className="size-6" />
            </div>
          ) : (
            <SettlePayoutsForm
              key={targetKey}
              initialRows={data.rows}
              reloadRows={async () =>
                (await fetchSettlePayoutRows({ kind: target.kind, id: target.id })).rows
              }
              cashRegisters={data.cashRegisters}
              defaultCashRegisterId={data.defaultCashRegisterId}
              labelHeader={target.kind === 'worker' ? 'Inwestycja' : 'Pracownik'}
              labelHref={
                target.kind === 'worker'
                  ? (row) => `/inwestycje/${row.investmentId}/kosztorys_v2`
                  : undefined
              }
              onSubmitSuccess={close}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
