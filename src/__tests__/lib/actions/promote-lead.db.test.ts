import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { insertTestMedia, purgeTestMedia } from '@/__tests__/helpers/media'
import { createTestInvestment } from '@/__tests__/helpers/investment'

// a „copy" would pass every count assertion while quietly doubling the storage bill — so the ids
// themselves are what this asserts.

const NAME = 'EX-802 promoted lead'
const OTHER_NAME = 'EX-802 unrelated investment'
const FILENAMES = ['ex-802-promote-a.jpg', 'ex-802-promote-b.pdf']
const FILENAME_PREFIX = 'ex-802-promote-'

const FORM_DATA = {
  name: NAME,
  address: 'ul. Testowa 1',
  phone: '500600700',
  email: 'test@example.com',
  contactPerson: 'Anna Testowa',
  notes: 'Zakres prac: łazienka',
  reviewRequested: false,
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
    await purgeTestMedia(db, FILENAME_PREFIX)
  }

  const investmentAssetIds = async (investmentId: number) => {
    const { rows } = await db.execute(sql`
      SELECT media_id FROM investments_rels
      WHERE parent_id = ${investmentId} AND path = 'assets'
      ORDER BY "order"
    `)
    return rows.map((row) => Number(row.media_id))
  }

  const createOtherInvestment = () => createTestInvestment(payload, OTHER_NAME)

  const livingMediaIds = async () => {
    const { rows } = await db.execute(sql`
      SELECT id FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`} ORDER BY id
    `)
    return rows.map((row) => Number(row.id))
  }

  beforeAll(async () => {
    authState.role = 'ADMIN'
    payload = await bootTestPayload()
    db = await getDb(payload)
    promoteLeadAction = (await import('@/lib/actions/promote-lead')).promoteLeadAction
    attachLeadAssetsAction = (await import('@/lib/actions/lead-assets')).attachLeadAssetsAction
  })

  beforeEach(async () => {
    await purge()

    mediaIds = []
    for (const filename of FILENAMES) mediaIds.push(await insertTestMedia(db, filename))

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

    const result = await attachLeadAssetsAction(leadId, investmentId, mediaIds)

    expect(result.success).toBe(true)
    expect(await investmentAssetIds(investmentId)).toEqual(mediaIds)
  })

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

    expect(await livingMediaIds()).toEqual([...mediaIds].sort((a, b) => a - b))
    expect(await investmentAssetIds(investmentId)).toEqual(mediaIds)
  })
})
