import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from './get-db'
import { text } from './row-coerce'

export type PushSubscriptionKeysT = { endpoint: string; p256dh: string; auth: string }

/**
 * The endpoint is the device, so a conflict moves it to the caller: a phone handed to another worker
 * stops receiving the previous owner's pushes the first time the new one opens the app on it.
 */
export async function upsertPushSubscription(
  db: DbExecutorT,
  userId: number,
  subscription: PushSubscriptionKeysT & { userAgent: string | undefined },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (${userId}, ${subscription.endpoint}, ${subscription.p256dh}, ${subscription.auth},
      ${subscription.userAgent ?? null})
    ON CONFLICT (endpoint) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      last_seen_at = now()
  `)
}

export async function deletePushSubscription(
  db: DbExecutorT,
  userId: number,
  endpoint: string,
): Promise<void> {
  await db.execute(
    sql`DELETE FROM push_subscriptions WHERE user_id = ${userId} AND endpoint = ${endpoint}`,
  )
}

export async function deletePushSubscriptions(db: DbExecutorT, userId: number): Promise<void> {
  await db.execute(sql`DELETE FROM push_subscriptions WHERE user_id = ${userId}`)
}

/** Only for an endpoint the push service has declared gone (404/410) — see `sendPushToUser`. */
export async function deletePushSubscriptionByEndpoint(
  db: DbExecutorT,
  endpoint: string,
): Promise<void> {
  await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`)
}

/**
 * The account state is joined, not left to the rows: `updateWorkerAction` can deactivate an account
 * without touching its subscriptions — the same reason `isSessionAlive` joins it.
 */
export async function selectLivePushSubscriptions(
  db: DbExecutorT,
  userId: number,
): Promise<PushSubscriptionKeysT[]> {
  const { rows } = await db.execute(sql`
    SELECT s.endpoint, s.p256dh, s.auth
    FROM push_subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.user_id = ${userId}
      AND u.active IS NOT FALSE
      AND u.trashed_at IS NULL
  `)
  return rows.map((row) => ({
    endpoint: text(row.endpoint),
    p256dh: text(row.p256dh),
    auth: text(row.auth),
  }))
}
