import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { fetchTrashedLeads } from '@/lib/db/lead-trash'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// The session is mocked rather than `requireAuth`, so the role gate under test is the real one.

vi.mock('server-only', () => ({}))

const { session } = vi.hoisted(() => ({ session: { role: 'OWNER' } }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: vi.fn(async () => ({ id: 1, role: session.role, name: 'T', email: 't@t.pl' })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = 'EX-970 lead'
const FILE_PREFIX = 'ex-970-lead-trash-'
const runTag = Date.now()

describe.skipIf(!ENV_READY)('lead trash actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/lead-trash')
  const investmentIds: number[] = []
  let serial = 0

  const createLead = async (data: { name?: string; assets?: number[] } = {}) => {
    const name = 'name' in data ? data.name : `${PREFIX} ${++serial}`
    const lead = await payload.create({
      collection: 'leads',
      data: {
        source: 'facebook_lead_ads',
        externalId: `${PREFIX}-${runTag}-${++serial}`,
        name,
        address: 'ul. Testowa 1',
        rawData: [{ name: 'pytanie', values: ['odpowiedź'] }],
        assets: data.assets ?? [],
        contactStatus: 'new',
        notifyStatus: 'sent',
        autoReplyStatus: 'skipped',
      },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    return { id: lead.id, name: name ?? '', externalId: lead.externalId }
  }

  const insertMedia = async (suffix: string) => {
    // Raw INSERT rather than an upload: a fixture nobody opens should not push bytes at Blob.
    const { rows } = await db.execute(sql`
      INSERT INTO media (filename, mime_type, filesize, kind)
      VALUES (${`${FILE_PREFIX}${runTag}-${suffix}.jpg`}, 'image/jpeg', 1024, 'zdjecie')
      RETURNING id
    `)
    return Number(rows[0].id)
  }

  const readLead = async (id: number) => {
    const { rows } = await db.execute(
      sql`SELECT name, address, raw_data, external_id, trashed_at, erased_at FROM leads WHERE id = ${id}`,
    )
    return rows[0]
  }

  const mediaExists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM media WHERE id = ${id}`)
    return rows.length > 0
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/lead-trash')
  }, 30000)

  beforeEach(() => {
    session.role = 'OWNER'
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM leads WHERE external_id LIKE ${`${PREFIX}-${runTag}-%`}`)
    for (const id of investmentIds) await deleteTestInvestment(payload, id)
    await db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILE_PREFIX}${runTag}-%`}`)
  })

  it('lets a MANAGER trash in bulk, restore, and erase a lead into a tombstone', async () => {
    session.role = 'MANAGER'
    const first = await createLead()
    const second = await createLead()

    expect((await actions.trashLeadsAction([first.id, second.id])).success).toBe(true)
    expect((await readLead(first.id)).trashed_at).not.toBeNull()
    expect((await readLead(second.id)).trashed_at).not.toBeNull()

    expect((await actions.restoreLeadAction(second.id)).success).toBe(true)
    expect((await readLead(second.id)).trashed_at).toBeNull()

    expect((await actions.deleteLeadForeverAction(first.id, first.name)).success).toBe(true)
    const tombstone = await readLead(first.id)
    expect(tombstone).toMatchObject({
      name: null,
      address: null,
      raw_data: null,
      external_id: first.externalId,
    })
    expect(tombstone.erased_at).not.toBeNull()
    expect((await fetchTrashedLeads(db)).map((row) => row.id)).not.toContain(first.id)
  })

  it('skips a missing or already-trashed id, keeping the first trash date', async () => {
    const lead = await createLead()
    await actions.trashLeadsAction([lead.id])
    const firstDate = (await readLead(lead.id)).trashed_at

    expect(await actions.trashLeadsAction([lead.id, -1])).toEqual({
      success: true,
      data: { trashed: 0 },
    })
    expect((await readLead(lead.id)).trashed_at).toEqual(firstDate)
  })

  it('refuses an empty selection', async () => {
    expect((await actions.trashLeadsAction([])).success).toBe(false)
  })

  it('refuses an erase whose typed name does not match, or of a lead not in the trash', async () => {
    const lead = await createLead()
    expect(await actions.deleteLeadForeverAction(lead.id, lead.name)).toEqual({
      success: false,
      error: 'Najpierw przenieś zgłoszenie do kosza.',
    })

    await actions.trashLeadsAction([lead.id])
    expect((await actions.deleteLeadForeverAction(lead.id, 'ktoś inny')).success).toBe(false)
    expect((await readLead(lead.id)).erased_at).toBeNull()
  })

  it('confirms a nameless lead by its fallback name, and will not restore the tombstone', async () => {
    const lead = await createLead({ name: undefined })
    await actions.trashLeadsAction([lead.id])

    expect((await actions.deleteLeadForeverAction(lead.id, `Zgłoszenie #${lead.id}`)).success).toBe(
      true,
    )
    expect((await actions.restoreLeadAction(lead.id)).success).toBe(false)
    expect((await readLead(lead.id)).trashed_at).not.toBeNull()
  })

  it('refuses an EMPLOYEE every action', async () => {
    const lead = await createLead()
    session.role = 'EMPLOYEE'

    expect((await actions.trashLeadsAction([lead.id])).success).toBe(false)
    expect((await readLead(lead.id)).trashed_at).toBeNull()
  })

  // The owner's condition for the whole feature: a lead promoted to an inwestycja shares its media
  // rows with it, and erasing the lead must not take a single file from the inwestycja.
  it('erasing a promoted lead keeps every file the inwestycja holds and drops only its own', async () => {
    const shared = await insertMedia('shared')
    const leadOnly = await insertMedia('lead-only')
    const investmentId = await createTestInvestment(payload, `${PREFIX} inwestycja ${runTag}`, {
      assets: [shared],
    })
    investmentIds.push(investmentId)
    const lead = await createLead({ assets: [shared, leadOnly] })

    await actions.trashLeadsAction([lead.id])
    expect((await actions.deleteLeadForeverAction(lead.id, lead.name)).success).toBe(true)

    expect(await mediaExists(shared)).toBe(true)
    expect(await mediaExists(leadOnly)).toBe(false)
    const investment = await payload.findByID({
      collection: 'investments',
      id: investmentId,
      depth: 0,
      overrideAccess: true,
    })
    expect(investment.assets).toEqual([shared])
  })
})
