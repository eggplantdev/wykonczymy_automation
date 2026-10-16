import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { countPendingPayouts } from '@/lib/db/payout-confirmation'
import { translate } from '@/lib/i18n/translations'
import { PAYOUT_PUSH_PAUSED } from '@/lib/push/constants'
import { isPushConfigured, sendPushToUser } from '@/lib/push/send-push'
import { formatPLN } from '@/lib/utils/format-currency'
import { logError } from '@/lib/utils/log-error'

export type BookedPayoutT = { workerId: number; amount: number }

export async function notifyPendingPayouts(
  db: DbExecutorT,
  payouts: BookedPayoutT[],
): Promise<void> {
  if (PAYOUT_PUSH_PAUSED || !isPushConfigured()) return

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
        // TODO(EX-958) SENTRY-REQUIRED: a refused push is invisible to the user who missed it.
        logError('[PUSH] payout notification aborted', err, { workerId })
      }
    }),
  )
}
