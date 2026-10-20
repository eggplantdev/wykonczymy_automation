'use client'

import { useEffect, useState } from 'react'
import { Description } from '@/components/ui/description'
import { Dialog, DialogBody, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { BlockLoading } from '@/components/ui/inline-loading'
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

export function SettlePayoutsDialog({ target, onClose }: SettlePayoutsDialogPropsT) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-dialog-lg">
        <DialogHeader title={target ? `Rozlicz wypłaty — ${target.name}` : 'Rozlicz wypłaty'} />
        <DialogBody className="mt-6 pr-1">
          {/* Keyed and unmounted on close, so a reopen after a booking — or a result landing for
              a row no longer open — never shows figures the dialog did not just fetch. */}
          {target && (
            <SettleDialogBody
              key={`${target.kind}:${target.id}`}
              target={target}
              onClose={onClose}
            />
          )}
        </DialogBody>
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

  if (loaded?.error)
    return (
      <Description tone="error" withIcon={false}>
        {loaded.error}
      </Description>
    )
  if (!loaded?.data) return <BlockLoading />
  const { data } = loaded
  return (
    <SettlePayoutsForm
      initialRows={data.rows}
      reloadRows={async () =>
        (await fetchSettlePayoutRows({ kind: target.kind, id: target.id })).rows
      }
      cashRegisters={data.cashRegisters}
      defaultCashRegisterId={data.defaultCashRegisterId}
      defaultRegisterBalance={data.defaultRegisterBalance}
      labelHeader={target.kind === 'worker' ? 'Inwestycja' : 'Pracownik'}
      labelHref={
        target.kind === 'worker'
          ? (row) => `/inwestycje/${row.investmentId}/kosztorys_v2`
          : undefined
      }
      pairNames={(row) =>
        target.kind === 'worker'
          ? { worker: target.name, investment: row.label }
          : { worker: row.label, investment: target.name }
      }
      onSubmitSuccess={onClose}
    />
  )
}
