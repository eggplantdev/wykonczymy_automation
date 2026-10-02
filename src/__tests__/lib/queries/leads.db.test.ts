import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { countUnreadLeads } from '@/lib/db/notifications'
import { fetchLeadsPage } from '@/lib/queries/leads'

// A trashed lead has three readers to escape: the /zgloszenia rows, the „N nowych" count beside
// them, and the raw-SQL nav badge. Counts are asserted as a difference — the shared test DB carries
// leads of its own.

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: async () => ({ success: true, user: { id: 1, role: 'OWNER' } }),
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = `EX-970 hidden ${Date.now()}`
// No `notification_reads` row exists for it, so the badge reads from the stream's epoch.
const NEVER_LOOKED = -1

describe.skipIf(!ENV_READY)('a trashed lead is hidden from its readers (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const ids: number[] = []

  const createLead = async (name: string) => {
    const lead = await payload.create({
      collection: 'leads',
      data: { source: 'website_form', name },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    ids.push(lead.id)
    return lead.id
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
  }, 30000)

  afterAll(async () => {
    for (const id of ids) await db.execute(sql`DELETE FROM leads WHERE id = ${id}`)
  })

  it('drops the lead from the rows, the „nowe" count and the nav badge', async () => {
    const liveId = await createLead(`${MARKER} live`)
    const trashedId = await createLead(`${MARKER} trashed`)

    const before = await fetchLeadsPage(1, 50, '-submittedAt', MARKER)
    const badgeBefore = await countUnreadLeads(payload, NEVER_LOOKED)
    expect(before.rows.map((row) => row.id).sort()).toEqual([liveId, trashedId].sort())

    await db.execute(sql`UPDATE leads SET trashed_at = now() WHERE id = ${trashedId}`)

    const after = await fetchLeadsPage(1, 50, '-submittedAt', MARKER)
    expect(after.rows.map((row) => row.id)).toEqual([liveId])
    expect(after.paginationMeta.totalDocs).toBe(1)
    expect(before.newCount - after.newCount).toBe(1)
    expect(badgeBefore - (await countUnreadLeads(payload, NEVER_LOOKED))).toBe(1)
  })
})
