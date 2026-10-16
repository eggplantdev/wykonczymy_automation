import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { getDb } from './get-db'
import type { SqlT } from './sql-list'

export const STREAMS = {
  leads: 'leads',
  fleet: 'fleet',
  equipment: 'equipment',
} as const

export type StreamT = (typeof STREAMS)[keyof typeof STREAMS]

// Fallback cursor for a user who has never opened the stream's page (no notification_reads
// row yet): treat everything before the feature's deploy as already seen, so nobody
// gets a scary "247 unread" badge on rollout.
const EPOCHS: Record<StreamT, string> = {
  leads: '2026-07-08T00:00:00Z',
  fleet: '2026-08-18T00:00:00Z',
  equipment: '2026-09-03T00:00:00Z',
}

export const unreadLeadsSql = (userId: number): SqlT => sql`
    SELECT COUNT(*) AS count
    FROM leads
    WHERE trashed_at IS NULL
      AND created_at > COALESCE(
        (SELECT seen_at FROM notification_reads
         WHERE user_id = ${userId} AND stream = ${STREAMS.leads}),
        ${EPOCHS.leads}::timestamptz
      )
  `

export const countUnreadLeads = async (payload: Payload, userId: number): Promise<number> => {
  const db = await getDb(payload)
  const result = await db.execute(unreadLeadsSql(userId))
  return Number(result.rows[0].count)
}

/**
 * `GREATEST(…, created_at)` covers the case that date alone cannot: a policy *entered* today that
 * expires in five days slid into the window before it existed, so its window-entry instant is older
 * than any cursor and the most urgent thing in the fleet would never reach the badge.
 *
 * `today` is the Warsaw day, passed in rather than read as Postgres `now()` (UTC) — otherwise the
 * badge and the listing disagree about the window for the last two hours of every day.
 */
export const unreadFleetDeadlinesSql = (userId: number, today: string): SqlT => sql`
    WITH read_cursor AS (
      SELECT COALESCE(
        (SELECT seen_at FROM notification_reads
         WHERE user_id = ${userId} AND stream = ${STREAMS.fleet}),
        ${EPOCHS.fleet}::timestamptz
      ) AS seen_at
    ),
    current_deadlines AS (
      SELECT DISTINCT ON (i.vehicle_id, i.type) i.next_due_at, i.created_at
      FROM vehicle_inspections i
      JOIN vehicles v ON v.id = i.vehicle_id AND v.status = 'ACTIVE' AND v.trashed_at IS NULL
      ORDER BY i.vehicle_id, i.type, i.performed_at DESC
    )
    SELECT COUNT(*) AS count
    FROM current_deadlines, read_cursor
    WHERE current_deadlines.next_due_at IS NOT NULL
      AND current_deadlines.next_due_at <= ${today}::date + interval '30 days'
      AND GREATEST(
            current_deadlines.next_due_at - interval '30 days',
            current_deadlines.created_at
          ) > read_cursor.seen_at
  `

export const countUnreadFleetDeadlines = async (
  payload: Payload,
  userId: number,
  today: string,
): Promise<number> => {
  const db = await getDb(payload)
  const result = await db.execute(unreadFleetDeadlinesSql(userId, today))
  return Number(result.rows[0].count)
}

export const unreadWarrantiesSql = (userId: number, today: string): SqlT => sql`
    WITH read_cursor AS (
      SELECT COALESCE(
        (SELECT seen_at FROM notification_reads
         WHERE user_id = ${userId} AND stream = ${STREAMS.equipment}),
        ${EPOCHS.equipment}::timestamptz
      ) AS seen_at
    )
    SELECT COUNT(*) AS count
    FROM equipment e, read_cursor
    WHERE e.status = 'IN_USE'
      AND e.trashed_at IS NULL
      AND e.warranty_until IS NOT NULL
      AND e.warranty_until >= ${today}::date
      AND e.warranty_until <= ${today}::date + interval '30 days'
      AND GREATEST(e.warranty_until - interval '30 days', e.created_at) > read_cursor.seen_at
  `

export const countUnreadWarranties = async (
  payload: Payload,
  userId: number,
  today: string,
): Promise<number> => {
  const db = await getDb(payload)
  const result = await db.execute(unreadWarrantiesSql(userId, today))
  return Number(result.rows[0].count)
}

export const markSeen = async (
  payload: Payload,
  userId: number,
  stream: StreamT,
): Promise<void> => {
  const db = await getDb(payload)

  await db.execute(sql`
    INSERT INTO notification_reads (user_id, stream, seen_at)
    VALUES (${userId}, ${stream}, now())
    ON CONFLICT (user_id, stream)
    DO UPDATE SET seen_at = now()
  `)
}
