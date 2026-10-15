import { describe, it, expect, beforeAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  countUnreadFleetDeadlines,
  countUnreadLeads,
  countUnreadWarranties,
} from '@/lib/db/notifications'
import { countRejectedPayouts } from '@/lib/db/payout-confirmation'
import { countShellBadges } from '@/lib/db/shell-badge-counts'
import { countPendingExpenseDrafts } from '@/lib/db/worker-expense-drafts'
import { countPendingReports } from '@/lib/db/worker-reports'
import { warsawToday } from '@/lib/utils/days'

// The shell reads every badge in one statement; each section page still counts its own stream.
// Two readers of one figure drift apart silently, so the merged statement is pinned to the six
// per-stream counters on whatever the shared test DB holds — read-only, no fixtures.

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
// No `notification_reads` row exists for it, so the cursor counters read from each stream's epoch.
const NEVER_LOOKED = -1

describe.skipIf(!ENV_READY)('countShellBadges (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let userWithCursor: number | undefined

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const res = await db.execute(sql`SELECT user_id FROM notification_reads LIMIT 1`)
    userWithCursor = res.rows[0] ? Number(res.rows[0].user_id) : undefined
  })

  const separately = async (userId: number, today: string) => ({
    leads: await countUnreadLeads(payload, userId),
    fleet: await countUnreadFleetDeadlines(payload, userId, today),
    equipment: await countUnreadWarranties(payload, userId, today),
    workerReports: await countPendingReports(db),
    expenseDrafts: await countPendingExpenseDrafts(db),
    rejectedPayouts: await countRejectedPayouts(db),
  })

  it('matches the six per-stream counters for a user who never opened a section', async () => {
    const today = warsawToday()
    expect(await countShellBadges(db, NEVER_LOOKED, today)).toEqual(
      await separately(NEVER_LOOKED, today),
    )
  })

  it('matches them for a user with read cursors', async () => {
    if (userWithCursor === undefined) return
    const today = warsawToday()
    expect(await countShellBadges(db, userWithCursor, today)).toEqual(
      await separately(userWithCursor, today),
    )
  })
})
