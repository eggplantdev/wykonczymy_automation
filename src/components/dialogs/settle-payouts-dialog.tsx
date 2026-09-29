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
 * Controlled rather than `FormDialog`, whose trigger-per-instance model would mount one dialog per
 * table row.
 */
export function SettlePayoutsDialog({ target, onClose }: SettlePayoutsDialogPropsT) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader title={target ? `Rozlicz wypłaty — ${target.name}` : 'Rozlicz wypłaty'} />
        <div className="mt-6 pr-1">
          {/* Keyed and unmounted on close, so a reopen after a booking — or a result landing for
              a row no longer open — never shows figures the dialog did not just fetch. */}
          {target && (
            <SettleDialogBody
              key={`${target.kind}:${target.id}`}
              target={target}
              onClose={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SettleDialogBody({
  target,
  onClose,
}: {
  target: SettleDialogTargetT
  onClose: () => void
}) {
  const [loaded, setLoaded] = useState<{ data?: SettlePayoutRowsT; error?: string }>()

  useEffect(() => {
    let cancelled = false
    fetchSettlePayoutRows({ kind: target.kind, id: target.id })
      .then((data) => {
        if (!cancelled) setLoaded({ data })
      })
      .catch((err) => {
        logError('[SETTLE_PAYOUTS_LOAD]', err)
        if (!cancelled) setLoaded({ error: 'Nie udało się wczytać kwot' })
      })
    return () => {
      cancelled = true
    }
  }, [target.kind, target.id])

  if (loaded?.error) return <p className="text-destructive text-sm">{loaded.error}</p>
  if (!loaded?.data) {
    return (
      <div className="flex h-40 items-center justify-center">
        <GradientSpinner className="size-6" />
      </div>
    )
  }
  const { data } = loaded
  return (
    <SettlePayoutsForm
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
      onSubmitSuccess={onClose}
    />
  )
}
