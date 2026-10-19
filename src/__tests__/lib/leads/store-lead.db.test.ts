import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { storeLead, type StoreLeadInputT } from '@/lib/leads/store-lead'
import { captureLead } from '@/lib/leads/capture-lead'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { insertTestMedia } from '@/__tests__/helpers/media'

// Unique per run so re-runs never collide on the compound unique index.
const runTag = `test-${Date.now()}`

const makeInput = (externalId: string): StoreLeadInputT => ({
  source: 'facebook_lead_ads',
  externalId,
  email: 'anna.nowak@example.com',
  name: 'Anna Nowak',
  phone: '+48500600700',
  rawData: [{ name: 'adres_e-mail', values: ['anna.nowak@example.com'] }],
  formId: '899352536400611',
  submittedAt: '2026-07-05T18:48:40.000Z',
})

describe.skipIf(!ENV_READY)('storeLead + captureLead (DB)', () => {
  let payload: Payload
  const createdIds: number[] = []

  beforeAll(async () => {
    payload = await bootTestPayload()
  })

  afterAll(async () => {
    for (const id of createdIds) {
      await payload.delete({ collection: 'leads', id, overrideAccess: true }).catch(() => {})
    }
  })

  it('is idempotent on (source, externalId) — storing twice yields one row', async () => {
    const externalId = `${runTag}-idem`
    const input = makeInput(externalId)

    const first = await storeLead(payload, input)
    createdIds.push(first.lead.id)
    const second = await storeLead(payload, input)

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.lead.id).toBe(first.lead.id)

    const rows = await payload.find({
      collection: 'leads',
      where: {
        and: [{ source: { equals: 'facebook_lead_ads' } }, { externalId: { equals: externalId } }],
      },
      overrideAccess: true,
    })
    expect(rows.totalDocs).toBe(1)
  })

  it('neither re-creates nor re-notifies an erased lead on redelivery', async () => {
    const externalId = `${runTag}-erased`
    const input = makeInput(externalId)
    const { lead } = await storeLead(payload, input)
    createdIds.push(lead.id)
    const db = await getDb(payload)
    await db.execute(sql`
      UPDATE leads SET name = NULL, email = NULL, phone = NULL, trashed_at = now(), erased_at = now()
      WHERE id = ${lead.id}
    `)

    let sent = 0
    const original = payload.sendEmail
    payload.sendEmail = async () => {
      sent += 1
    }
    try {
      const again = await captureLead(payload, input)
      expect(again).toMatchObject({ created: false, lead: { id: lead.id } })
    } finally {
      payload.sendEmail = original
    }

    expect(sent).toBe(0)
    const { rows } = await db.execute(sql`
      SELECT name, notify_status FROM leads
      WHERE source = 'facebook_lead_ads' AND external_id = ${externalId}
    `)
    expect(rows).toEqual([{ name: null, notify_status: 'pending' }])
  })

  it('persists the lead with notifyStatus=failed when the email send throws', async () => {
    const externalId = `${runTag}-mailfail`
    const original = payload.sendEmail
    payload.sendEmail = async () => {
      throw new Error('smtp down')
    }

    try {
      const { lead } = await captureLead(payload, makeInput(externalId))
      createdIds.push(lead.id)

      const persisted = await payload.findByID({
        collection: 'leads',
        id: lead.id,
        overrideAccess: true,
      })
      expect(persisted.notifyStatus).toBe('failed')
      expect(persisted.email).toBe('anna.nowak@example.com')
    } finally {
      payload.sendEmail = original
    }
  })

  it('persists the lead with notifyStatus=sent when the email send succeeds', async () => {
    const externalId = `${runTag}-mailok`
    const original = payload.sendEmail
    payload.sendEmail = async () => undefined

    try {
      const { lead } = await captureLead(payload, makeInput(externalId))
      createdIds.push(lead.id)

      const persisted = await payload.findByID({
        collection: 'leads',
        id: lead.id,
        overrideAccess: true,
      })
      expect(persisted.notifyStatus).toBe('sent')
    } finally {
      payload.sendEmail = original
    }
  })

  it('round-trips a landing lead with its typed answers and attached files', async () => {
    const db = await getDb(payload)
    const mediaIds: number[] = []
    for (const filename of [`${runTag}-lazienka.jpg`, `${runTag}-salon.jpg`]) {
      mediaIds.push(await insertTestMedia(db, filename))
    }

    const { lead } = await storeLead(payload, {
      source: 'landing_form',
      externalId: `${runTag}-landing`,
      email: 'jan.kowalski@example.com',
      name: 'Jan Kowalski',
      phone: '+48500600700',
      address: 'ul. Kwiatowa 5, Warszawa',
      scope: 'Remont lazienki i salonu',
      area: '30-60 m2',
      rawData: [{ name: 'metraz', values: ['30-60 m2'] }],
    })
    createdIds.push(lead.id)

    await payload.update({
      collection: 'leads',
      id: lead.id,
      data: { assets: mediaIds },
      overrideAccess: true,
    })

    const persisted = await payload.findByID({
      collection: 'leads',
      id: lead.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(persisted.source).toBe('landing_form')
    expect(persisted.address).toBe('ul. Kwiatowa 5, Warszawa')
    expect(persisted.scope).toBe('Remont lazienki i salonu')
    expect(persisted.area).toBe('30-60 m2')
    expect(persisted.assets).toEqual(mediaIds)

    for (const id of mediaIds) {
      await db.execute(sql`DELETE FROM media WHERE id = ${id}`)
    }
  })
})
