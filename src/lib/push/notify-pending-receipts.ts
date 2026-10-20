import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { countPendingReceipts } from '@/lib/db/receipt-confirmation'
import { translate } from '@/lib/i18n/translations'
import { RECEIPT_PUSH_PAUSED } from '@/lib/push/constants'
import { isPushConfigured, sendPushToUser } from '@/lib/push/send-push'
import { formatPLN } from '@/lib/utils/format-currency'
import { logError } from '@/lib/utils/log-error'

export type BookedReceiptT = { recipientId: number; amount: number }

export async function notifyPendingReceipts(
  db: DbExecutorT,
  receipts: BookedReceiptT[],
): Promise<void> {
  if (RECEIPT_PUSH_PAUSED || !isPushConfigured()) return

  const amountByRecipient = new Map<number, number>()
  for (const { recipientId, amount } of receipts) {
    amountByRecipient.set(recipientId, (amountByRecipient.get(recipientId) ?? 0) + amount)
  }

  await Promise.all(
    [...amountByRecipient].map(async ([recipientId, amount]) => {
      try {
        const badgeCount = await countPendingReceipts(db, recipientId)
        await sendPushToUser(db, recipientId, (locale) => ({
          title: translate(locale, 'workerPage', 'receiptPushTitle'),
          body: translate(locale, 'workerPage', 'receiptPushBody', { amount: formatPLN(amount) }),
          url: `/pracownicy/${recipientId}`,
          tag: 'payout-pending',
          badgeCount,
        }))
      } catch (err) {
        // TODO(EX-958) SENTRY-REQUIRED: a refused push is invisible to the user who missed it.
        logError('[PUSH] receipt notification aborted', err, { recipientId })
      }
    }),
  )
}
