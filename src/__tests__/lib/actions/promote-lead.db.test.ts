import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { SETTLEMENT_MODE_DEFAULT } from '@/lib/kosztorys/settlement-mode'

// Promotion is the one place two collections point at the same media rows, and a „copy" would pass
// every count assertion while quietly doubling the storage bill — so the ids themselves are what
// this asserts, read back from investments_rels rather than from the action's result.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: 1, role: 'ADMIN', name: 'T', email: 't@t.pl' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const NAME = 'EX-802 promoted lead'
const OTHER_NAME = 'EX-802 unrelated investment'
const FILENAMES = ['ex-802-promote-a.jpg', 'ex-802-promote-b.pdf']
const FILENAME_PREFIX = 'ex-802-promote-%'

const FORM_DATA = {
  name: NAME,
  address: 'ul. Testowa 1',
  phone: '500600700',
  email: 'test@example.com',
  contactPerson: 'Anna Testowa',
  notes: 'Zakres prac: łazienka',
  review: '',
  status: 'active' as const,
  presetId: '',
  assets: [],
}

describe.skipIf(!ENV_READY)('promoteLeadAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let leadId: number
  let mediaIds: number[]
  let promoteLeadAction: typeof import('@/lib/actions/promote-lead').promoteLeadAction
  let attachLeadAssetsAction: typeof import('@/lib/actions/lead-assets').attachLeadAssetsAction

  const purge = async () => {
    await db.execute(sql`DELETE FROM leads WHERE name = ${NAME}`)
    await db.execute(sql`DELETE FROM investments WHERE name IN (${NAME}, ${OTHER_NAME})`)
    await db.execute(sql`DELETE FROM media WHERE filename LIKE ${FILENAME_PREFIX}`)
  }

  const investmentAssetIds = async (investmentId: number) => {
    const { rows } = await db.execute(sql`
      SELECT media_id FROM investments_rels
      WHERE parent_id = ${investmentId} AND path = 'assets'
      ORDER BY "order"
    `)
    return rows.map((row) => Number(row.media_id))
  }

  const createOtherInvestment = async () => {
    const other = await payload.create({
      collection: 'investments',
      data: { name: OTHER_NAME, status: 'active', settlementMode: SETTLEMENT_MODE_DEFAULT },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    return Number(other.id)
  }

  const livingMediaIds = async () => {
    const { rows } = await db.execute(sql`
      SELECT id FROM media WHERE filename LIKE ${FILENAME_PREFIX} ORDER BY id
    `)
    return rows.map((row) => Number(row.id))
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    promoteLeadAction = (await import('@/lib/actions/promote-lead')).promoteLeadAction
    attachLeadAssetsAction = (await import('@/lib/actions/lead-assets')).attachLeadAssetsAction
  })

  beforeEach(async () => {
    await purge()

    // Raw INSERT rather than an upload: a fixture nobody opens should not push bytes at Blob.
    mediaIds = []
    for (const filename of FILENAMES) {
      const { rows } = await db.execute(sql`
        INSERT INTO media (filename, mime_type, filesize, kind)
        VALUES (${filename}, 'image/jpeg', 1024, 'zdjecie')
        RETURNING id
      `)
      mediaIds.push(Number(rows[0].id))
    }

    const lead = await payload.create({
      collection: 'leads',
      data: {
        source: 'landing_form',
        name: NAME,
        contactStatus: 'new',
        notifyStatus: 'sent',
        autoReplyStatus: 'skipped',
        assets: mediaIds,
      },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    leadId = Number(lead.id)
  })

  afterAll(purge)

  it('hands the investment the lead’s own media ids and leaves the contact status alone', async () => {
    const result = await promoteLeadAction(leadId, FORM_DATA, mediaIds)
    expect(result.success).toBe(true)

    const lead = await payload.findByID({
      collection: 'leads',
      id: leadId,
      depth: 0,
      overrideAccess: true,
    })
    const investmentId = Number(lead.investment)

    expect(await investmentAssetIds(investmentId)).toEqual(mediaIds)
    // Promotion is not contact: only a human clicking the odznaka may flip this.
    expect(lead.contactStatus).toBe('new')
  })

  it('carries only the files the human kept, and ignores an id from another lead', async () => {
    const result = await promoteLeadAction(leadId, FORM_DATA, [mediaIds[0], -1])
    expect(result.success).toBe(true)

    const lead = await payload.findByID({
      collection: 'leads',
      id: leadId,
      depth: 0,
      overrideAccess: true,
    })

    expect(await investmentAssetIds(Number(lead.investment))).toEqual([mediaIds[0]])
  })

  it('sends a left-behind file across after the fact, without duplicating what already travelled', async () => {
    await promoteLeadAction(leadId, FORM_DATA, [mediaIds[0]])
    const lead = await payload.findByID({
      collection: 'leads',
      id: leadId,
      depth: 0,
      overrideAccess: true,
    })
    const investmentId = Number(lead.investment)

    // Both ids, including the one the investment already holds.
    const result = await attachLeadAssetsAction(leadId, investmentId, mediaIds)

    expect(result.success).toBe(true)
    expect(await investmentAssetIds(investmentId)).toEqual(mediaIds)
  })

  // The target is the caller's pick, not the zgłoszenie's own inwestycja — an unpromoted zgłoszenie
  // has files worth filing somewhere, and nothing here can un-attach a mis-click.
  it('attaches to an inwestycja the zgłoszenie was never promoted into', async () => {
    const otherId = await createOtherInvestment()

    const result = await attachLeadAssetsAction(leadId, otherId, mediaIds)

    expect(result.success).toBe(true)
    expect(await investmentAssetIds(otherId)).toEqual(mediaIds)
  })

  it('ignores an id the zgłoszenie does not own', async () => {
    const otherId = await createOtherInvestment()

    const result = await attachLeadAssetsAction(leadId, otherId, [mediaIds[0], -1])

    expect(result.success).toBe(true)
    expect(await investmentAssetIds(otherId)).toEqual([mediaIds[0]])
  })

  it('refuses a second promotion of the same lead', async () => {
    await promoteLeadAction(leadId, FORM_DATA, mediaIds)

    const second = await promoteLeadAction(leadId, FORM_DATA, mediaIds)

    expect(second.success).toBe(false)
    const { rows } = await db.execute(sql`SELECT id FROM investments WHERE name = ${NAME}`)
    expect(rows).toHaveLength(1)
  })

  it('leaves the files and the investment intact when the lead is deleted', async () => {
    await promoteLeadAction(leadId, FORM_DATA, mediaIds)
    const lead = await payload.findByID({
      collection: 'leads',
      id: leadId,
      depth: 0,
      overrideAccess: true,
    })
    const investmentId = Number(lead.investment)

    await payload.delete({
      collection: 'leads',
      id: leadId,
      overrideAccess: true,
      context: { skipRevalidation: true },
    })

    // The point of sharing the rows instead of copying them: removing the zgłoszenie must not strip
    // the inwestycja's zdjęcia.
    expect(await livingMediaIds()).toEqual([...mediaIds].sort((a, b) => a - b))
    expect(await investmentAssetIds(investmentId)).toEqual(mediaIds)
  })
})
