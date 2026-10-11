import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { countPendingPayouts } from '@/lib/db/payout-confirmation'
import { translate } from '@/lib/i18n/translations'
import { isPushConfigured, sendPushToUser } from '@/lib/push/send-push'
import { formatPLN } from '@/lib/utils/format-currency'
import { logError } from '@/lib/utils/log-error'

export type BookedPayoutT = { workerId: number; amount: number }

/**
 * One push per worker however many wypłaty one booking gave him, so a „Rozlicz wypłaty" across five
 * investments buzzes his phone once. Call it after commit: the badge counts what is stored.
 */
export async function notifyPendingPayouts(
  db: DbExecutorT,
  payouts: BookedPayoutT[],
): Promise<void> {
  if (!isPushConfigured()) return

  const amountByWorker = new Map<number, number>()
  for (const { workerId, amount } of payouts) {
    amountByWorker.set(workerId, (amountByWorker.get(workerId) ?? 0) + amount)
  }

  await Promise.all(
    [...amountByWorker].map(async ([workerId, amount]) => {
      try {
        const badgeCount = await countPendingPayouts(db, workerId)
        await sendPushToUser(db, workerId, (locale) => ({
          title: translate(locale, 'workerPage', 'payoutPushTitle'),
          body: translate(locale, 'workerPage', 'payoutPushBody', { amount: formatPLN(amount) }),
          url: `/pracownicy/${workerId}`,
          tag: 'payout-pending',
          badgeCount,
        }))
      } catch (err) {
        // TODO(EX-449) SENTRY-REQUIRED: a refused push is invisible to the user who missed it.
        logError('[PUSH] payout notification aborted', err, { workerId })
      }
    }),
  )
}
