import { sql } from '@payloadcms/db-vercel-postgres'
import type { Payload } from 'payload'
import { getDb } from './sum-transfers'

/** The only notification stream so far. When a second one lands, promote to an `as const` map. */
const LEADS_STREAM = 'leads'

// Fallback cursor for a user who has never opened /zgloszenia (no notification_reads
// row yet): treat everything before the feature's deploy as already seen, so nobody
// gets a scary "247 unread" badge on rollout. Only leads created after this instant
// count until the user's first visit writes a real cursor.
const LEADS_EPOCH = '2026-07-08T00:00:00Z'

/**
 * Unread new-lead count for one user: leads created after their read cursor
 * (or after LEADS_EPOCH if they've never visited). Powers the nav badge.
 */
export const countUnreadLeads = async (payload: Payload, userId: number): Promise<number> => {
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT COUNT(*) AS count
    FROM leads
    WHERE created_at > COALESCE(
      (SELECT seen_at FROM notification_reads
       WHERE user_id = ${userId} AND stream = ${LEADS_STREAM}),
      ${LEADS_EPOCH}::timestamptz
    )
  `)

  return Number(result.rows[0].count)
}

/** Advance the user's leads read cursor to now — called when they open /zgloszenia. */
export const markLeadsSeen = async (payload: Payload, userId: number): Promise<void> => {
  const db = await getDb(payload)

  await db.execute(sql`
    INSERT INTO notification_reads (user_id, stream, seen_at)
    VALUES (${userId}, ${LEADS_STREAM}, now())
    ON CONFLICT (user_id, stream)
    DO UPDATE SET seen_at = now()
  `)
}
