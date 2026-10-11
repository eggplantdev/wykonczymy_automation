'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PayoutStatusBadge } from '@/components/payouts/payout-status-badge'
import { RejectPayoutDialog } from '@/components/payouts/reject-payout-dialog'
import { acceptPayoutAction } from '@/lib/actions/payout-confirmation'
import type { PayoutToConfirmT } from '@/lib/db/payout-confirmation'
import { failureMessage } from '@/lib/i18n/failure-message'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { useTranslation } from '@/hooks/use-translation'

type OpenDialogT = { kind: 'accept' | 'reject'; payout: PayoutToConfirmT }

export function PayoutsToConfirm({ payouts }: { payouts: PayoutToConfirmT[] }) {
  const { locale, t } = useTranslation('workerPage')
  const transfersTranslator = useTranslation('transfers')
  const [openDialog, setOpenDialog] = useState<OpenDialogT>()
  // The confirm closes the dialog at once, so the row is what has to show the wait.
  const [pendingId, setPendingId] = useState<number>()
  if (payouts.length === 0) return null

  const close = () => setOpenDialog(undefined)

  async function handleAccept(transactionId: number) {
    setPendingId(transactionId)
    const result = await settleAction(() => acceptPayoutAction(transactionId))
    setPendingId(undefined)
    if (!result.success) {
      toastMessage(failureMessage(locale, result), 'error')
      return
    }
    toastMessage(t('payoutAccepted'), 'success')
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-300 p-4 dark:border-amber-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t('payoutsTitle')}</h2>
        <p className="text-muted-foreground text-sm">{t('payoutsHint')}</p>
      </div>
      <ul className="flex flex-col divide-y">
        {payouts.map((payout) => (
          <li key={payout.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-lg font-semibold tabular-nums">
                  {formatPLN(payout.amount)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {formatPLDate(payout.date)} · {payout.investmentName ?? t('payoutNoInvestment')}
                </span>
              </div>
              <PayoutStatusBadge
                status={payout.status}
                cancelled={payout.cancelled}
                translator={transfersTranslator}
              />
            </div>
            {payout.description && <p className="text-sm break-words">{payout.description}</p>}
            {payout.status === 'rejected' && payout.rejectionReason && (
              <p className="text-muted-foreground text-sm whitespace-pre-line">
                {t('payoutYourReason', { reason: payout.rejectionReason })}
              </p>
            )}
            {!payout.cancelled && (
              <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex">
                <Button
                  className="h-11"
                  disabled={pendingId === payout.id}
                  onClick={() => setOpenDialog({ kind: 'accept', payout })}
                >
                  {t('payoutConfirm')}
                </Button>
                {payout.status === 'pending' && (
                  <Button
                    variant="outline"
                    className="h-11"
                    disabled={pendingId === payout.id}
                    onClick={() => setOpenDialog({ kind: 'reject', payout })}
                  >
                    {t('payoutReject')}
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {openDialog?.kind === 'accept' && (
        <ConfirmDialog
          open
          variant="neutral"
          title={t('payoutAcceptTitle')}
          description={t('payoutAcceptDescription', {
            amount: formatPLN(openDialog.payout.amount),
          })}
          confirmLabel={t('payoutConfirm')}
          onConfirm={() => handleAccept(openDialog.payout.id)}
          onCancel={close}
        />
      )}
      {openDialog?.kind === 'reject' && (
        <RejectPayoutDialog
          transactionId={openDialog.payout.id}
          amount={openDialog.payout.amount}
          onClose={close}
        />
      )}
    </section>
  )
}
