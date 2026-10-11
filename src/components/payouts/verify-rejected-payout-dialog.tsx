'use client'

import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { InfoList } from '@/components/ui/info-list'
import { CancelTransferButton } from '@/components/transfers/cancel-transfer-button'
import type { RejectedPayoutT } from '@/lib/db/payout-confirmation'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'

type PropsT = {
  payout: RejectedPayoutT
  onClose: () => void
}

export function VerifyRejectedPayoutDialog({ payout, onClose }: PropsT) {
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:h-fit sm:max-w-lg">
        <DialogHeader
          title={`Odrzucona wypłata #${payout.id}`}
          description="Pracownik twierdzi, że nie dostał tej kwoty. Jeśli wypłata nie doszła do skutku, anuluj ją; jeśli doszła, wyjaśnij to z nim — może ją potwierdzić później."
        />
        <InfoList
          items={[
            { label: 'Pracownik', value: payout.workerName },
            { label: 'Kwota', value: formatPLN(payout.amount) },
            { label: 'Data', value: formatPLDate(payout.date) },
            { label: 'Inwestycja', value: payout.investmentName },
            { label: 'Kasa', value: payout.sourceRegisterName },
            { label: 'Opis', value: payout.description },
            { label: 'Odrzucona', value: formatPLDateTime(payout.decidedAt) },
            {
              label: 'Powód',
              value: <span className="whitespace-pre-line">{payout.rejectionReason}</span>,
            },
          ]}
        />
        <DialogFooter>
          {payout.investmentLockMessage ? (
            <p className="text-muted-foreground text-sm">{payout.investmentLockMessage}</p>
          ) : (
            <CancelTransferButton transactionId={payout.id} />
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
