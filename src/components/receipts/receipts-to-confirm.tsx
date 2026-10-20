'use client'

import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { CARD_LIST_CLASS, CARD_SHELL_CLASS } from '@/components/transfers/cards/card-list-classes'
import { cn } from '@/lib/utils/cn'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PayoutStatusBadge } from '@/components/receipts/receipt-status-badge'
import { RejectReceiptDialog } from '@/components/receipts/reject-receipt-dialog'
import { acceptReceiptAction } from '@/lib/actions/receipt-confirmation'
import type { ReceiptToConfirmT } from '@/lib/db/receipt-confirmation'
import { failureMessage } from '@/lib/i18n/failure-message'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { settleAction } from '@/lib/utils/settle-action'
import { syncAppBadge } from '@/lib/push/push-client'
import { toastMessage } from '@/lib/utils/toast'
import { useTranslation } from '@/hooks/use-translation'

type OpenDialogT = { kind: 'accept' | 'reject'; receipt: ReceiptToConfirmT }

export function ReceiptsToConfirm({ receipts }: { receipts: ReceiptToConfirmT[] }) {
  const { locale, t } = useTranslation('workerPage')
  const transfersTranslator = useTranslation('transfers')
  const [openDialog, setOpenDialog] = useState<OpenDialogT>()
  // The confirm closes the dialog at once, so the row is what has to show the wait.
  const [pendingId, setPendingId] = useState<number>()
  if (receipts.length === 0) return null

  const close = () => setOpenDialog(undefined)

  async function handleAccept(transactionId: number) {
    setPendingId(transactionId)
    const result = await settleAction(() => acceptReceiptAction(transactionId))
    setPendingId(undefined)
    if (!result.success) {
      toastMessage(failureMessage(locale, result), 'error')
      return
    }
    toastMessage(t('receiptAccepted'), 'success')
    void syncAppBadge()
  }

  const pending = receipts.filter((receipt) => receipt.status === 'pending')
  const rejected = receipts.filter((receipt) => receipt.status === 'rejected')

  const renderList = (items: ReceiptToConfirmT[]) => (
    <ul className={CARD_LIST_CLASS}>
      {items.map((receipt) => (
        <li key={receipt.id} className={cn('flex flex-col gap-3 p-4', CARD_SHELL_CLASS)}>
          <header className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {receipt.investmentName ?? t('receiptNoInvestment')}
              </span>
              <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                {formatPLDate(receipt.date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold tabular-nums">{formatPLN(receipt.amount)}</span>
              <div className="ml-auto shrink-0">
                <PayoutStatusBadge
                  status={receipt.status}
                  cancelled={false}
                  translator={transfersTranslator}
                />
              </div>
            </div>
          </header>
          {receipt.description && (
            <p className="line-clamp-3 text-sm break-words whitespace-pre-line">
              {receipt.description}
            </p>
          )}
          {receipt.status === 'rejected' && receipt.rejectionReason && (
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {t('receiptRejectionReason', { reason: receipt.rejectionReason })}
            </p>
          )}
          <div className="mt-1 grid auto-cols-fr grid-flow-col gap-2">
            <Button
              variant="greenOutline"
              className="h-11"
              disabled={pendingId === receipt.id}
              onClick={() => setOpenDialog({ kind: 'accept', receipt })}
            >
              <Check />
              {t('receiptConfirm')}
            </Button>
            {receipt.status === 'pending' && (
              <Button
                variant="redOutline"
                className="h-11"
                disabled={pendingId === receipt.id}
                onClick={() => setOpenDialog({ kind: 'reject', receipt })}
              >
                <Trash2 />
                {t('receiptReject')}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      {pending.length > 0 && (
        <CollapsibleSection
          title={t('receiptsTitle')}
          hint={t('receiptsHint')}
          storageKey="worker:payouts"
          withSeparator={false}
          className="sm:max-w-lg"
        >
          {renderList(pending)}
        </CollapsibleSection>
      )}
      {rejected.length > 0 && (
        <CollapsibleSection
          title={t('rejectedReceiptsTitle')}
          hint={t('rejectedReceiptsHint')}
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
          title={t('receiptAcceptTitle')}
          description={t('receiptAcceptDescription', {
            amount: formatPLN(openDialog.receipt.amount),
          })}
          confirmLabel={t('receiptConfirm')}
          onConfirm={() => handleAccept(openDialog.receipt.id)}
          onCancel={close}
        />
      )}
      {openDialog?.kind === 'reject' && (
        <RejectReceiptDialog
          transactionId={openDialog.receipt.id}
          amount={openDialog.receipt.amount}
          onClose={close}
        />
      )}
    </>
  )
}
