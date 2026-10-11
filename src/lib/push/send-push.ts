import 'server-only'
import { sendNotification } from 'web-push'
import { FRONTEND_URL, VAPID_PUBLIC_KEY } from '@/lib/env'
import { serverEnv } from '@/lib/env/server'
import type { DbExecutorT } from '@/lib/db/get-db'
import {
  deletePushSubscriptionByEndpoint,
  selectLivePushSubscriptions,
} from '@/lib/db/push-subscriptions'
import { selectUserLanguage } from '@/lib/db/user-language'
import { DEFAULT_LANGUAGE, type LanguageT } from '@/lib/i18n/languages'
import { logError } from '@/lib/utils/log-error'

/** Doubles as the push-service `topic`, which allows at most 32 URL-safe characters. */
type PushTagT = 'test'

export type PushMessageT = {
  title: string
  body: string
  url: string
  tag: PushTagT
  badgeCount?: number
}

// The push service keeps an undelivered message this long for a phone that is off.
const TTL_SECONDS = 24 * 60 * 60

// A stalled push service must not hold the `after()` that sends.
const SEND_TIMEOUT_MS = 10_000

// Only these say the subscription itself is dead. A 401/403 means our key pair was refused —
// deleting on it would wipe every device the moment a non-production pair ever sent.
const GONE_STATUSES = new Set([404, 410])

export const isPushConfigured = (): boolean =>
  VAPID_PUBLIC_KEY !== undefined && serverEnv.VAPID_PRIVATE_KEY !== undefined

/** Never throws: it runs inside `after()`, where a rejection has nobody to answer to. */
export async function sendPushToUser(
  db: DbExecutorT,
  userId: number,
  build: (locale: LanguageT) => PushMessageT,
): Promise<number> {
  const privateKey = serverEnv.VAPID_PRIVATE_KEY
  if (VAPID_PUBLIC_KEY === undefined || privateKey === undefined) return 0

  try {
    const vapidDetails = { subject: FRONTEND_URL, publicKey: VAPID_PUBLIC_KEY, privateKey }
    const subscriptions = await selectLivePushSubscriptions(db, userId)
    if (subscriptions.length === 0) return 0

    const message = build((await selectUserLanguage(db, userId)) ?? DEFAULT_LANGUAGE)
    const payload = JSON.stringify(message)
    const results = await Promise.allSettled(
      subscriptions.map(({ endpoint, p256dh, auth }) =>
        sendNotification({ endpoint, keys: { p256dh, auth } }, payload, {
          vapidDetails,
          TTL: TTL_SECONDS,
          urgency: 'high',
          topic: message.tag,
          timeout: SEND_TIMEOUT_MS,
        }),
      ),
    )

    let sent = 0
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') {
        sent++
        continue
      }
      const { endpoint } = subscriptions[index]
      const status = (result.reason as { statusCode?: unknown } | undefined)?.statusCode
      if (typeof status === 'number' && GONE_STATUSES.has(status)) {
        await deletePushSubscriptionByEndpoint(db, endpoint).catch((err: unknown) =>
          logError('[PUSH] gone subscription not deleted', err, { userId, endpoint }),
        )
        continue
      }
      // TODO(EX-449) SENTRY-REQUIRED: a refused push is invisible to the user who missed it.
      logError('[PUSH] send failed', result.reason, { userId, endpoint })
    }
    return sent
  } catch (err) {
    // TODO(EX-449) SENTRY-REQUIRED: a refused push is invisible to the user who missed it.
    logError('[PUSH] send aborted', err, { userId })
    return 0
  }
}
