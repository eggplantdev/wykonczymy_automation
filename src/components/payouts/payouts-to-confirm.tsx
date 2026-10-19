'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { CARD_LIST_CLASS, CARD_SHELL_CLASS } from '@/components/transfers/cards/card-list-classes'
import { cn } from '@/lib/utils/cn'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PayoutStatusBadge } from '@/components/payouts/payout-status-badge'
import { RejectPayoutDialog } from '@/components/payouts/reject-payout-dialog'
import { acceptPayoutAction } from '@/lib/actions/payout-confirmation'
import type { PayoutToConfirmT } from '@/lib/db/payout-confirmation'
import { failureMessage } from '@/lib/i18n/failure-message'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { settleAction } from '@/lib/utils/settle-action'
import { syncAppBadge } from '@/lib/push/push-client'
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
    void syncAppBadge()
  }

  const pending = payouts.filter((payout) => payout.status === 'pending')
  const rejected = payouts.filter((payout) => payout.status === 'rejected')

  const renderList = (items: PayoutToConfirmT[]) => (
    <ul className={CARD_LIST_CLASS}>
      {items.map((payout) => (
        <li
          key={payout.id}
          className={cn(
            'flex flex-col gap-3 p-4',
            CARD_SHELL_CLASS,
            payout.cancelled && 'text-muted-foreground opacity-70',
          )}
        >
          <header className="flex items-start gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-muted-foreground text-xs">{formatPLDate(payout.date)}</span>
              <span className="truncate text-sm font-medium">
                {payout.investmentName ?? t('payoutNoInvestment')}
              </span>
            </div>
            <div className="ml-auto shrink-0">
              <PayoutStatusBadge
                status={payout.status}
                cancelled={payout.cancelled}
                translator={transfersTranslator}
              />
            </div>
          </header>
          <span
            className={cn('text-lg font-semibold tabular-nums', payout.cancelled && 'line-through')}
          >
            {formatPLN(payout.amount)}
          </span>
          {payout.description && (
            <p className="line-clamp-3 text-sm break-words whitespace-pre-line">
              {payout.description}
            </p>
          )}
          {payout.status === 'rejected' && payout.rejectionReason && (
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {t('payoutYourReason', { reason: payout.rejectionReason })}
            </p>
          )}
          {!payout.cancelled && (
            <div className="mt-1 grid auto-cols-fr grid-flow-col gap-2">
              <Button
                className="h-11"
                disabled={pendingId === payout.id}
                onClick={() => setOpenDialog({ kind: 'accept', payout })}
              >
                {t('payoutConfirm')}
              </Button>
              {payout.status === 'pending' && (
                <Button
                  variant="destructive"
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
  )

  return (
    <>
      {pending.length > 0 && (
        <CollapsibleSection
          title={t('payoutsTitle')}
          hint={t('payoutsHint')}
          storageKey="worker:payouts"
          withSeparator={false}
          className="sm:max-w-lg"
        >
          {renderList(pending)}
        </CollapsibleSection>
      )}
      {rejected.length > 0 && (
        <CollapsibleSection
          title={t('rejectedPayoutsTitle')}
          hint={t('rejectedPayoutsHint')}
          storageKey="worker:payouts-rejected"
          withSeparator={false}
          className="sm:max-w-lg"
        >
          {renderList(rejected)}
        </CollapsibleSection>
      )}
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
    </>
  )
}
