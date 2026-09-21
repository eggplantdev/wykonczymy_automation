import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'

// The leads collection's afterChange hook calls revalidateTag, which throws outside a
// Next request context. Stub it — cache invalidation is not under test here.

import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { storeLead, type StoreLeadInputT } from '@/lib/leads/store-lead'
import { captureLead } from '@/lib/leads/capture-lead'

// Integration tests against the Payload Local API + local Postgres. Gated on DB env
// exactly like the parity test: skips cleanly with no DB, FAILS if env is set but the
// DB is unreachable. Run via `pnpm test` with DB_POSTGRES_URL + PAYLOAD_SECRET set.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

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
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    // 30s: first getPayload cold-inits Payload's schema; under the full integration suite the
    // default 10s hook budget is too tight (observed ~8.6–10s).
  }, 30000)

  afterAll(async () => {
    for (const id of createdIds) {
      await payload.delete({ collection: 'leads', id, overrideAccess: true }).catch(() => {})
    }
  })

  // Risk 3 — Meta redelivers the same leadgen_id on retry; a second store must not duplicate.
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

  // Risk 5 — a mail failure must never lose the lead; it only flips notifyStatus to 'failed'.
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
      // Assert the PERSISTED state, not the return value — a success result could hide a failed write.
      expect(persisted.notifyStatus).toBe('failed')
      expect(persisted.email).toBe('anna.nowak@example.com')
    } finally {
      payload.sendEmail = original
    }
  })

  // Risk 5 (happy path) — a successful send flips notifyStatus to 'sent'.
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

  // The landing's own fields — a shape no Facebook lead has. `assets` is the one that cannot be
  // read off the create's return value: it lands on `leads_rels`, a join table the migration had to
  // create by hand, so this is the only check that the table matches what Payload writes into it.
  it('round-trips a landing lead with its typed answers and attached files', async () => {
    const db = await getDb(payload)
    const mediaIds: number[] = []
    for (const filename of [`${runTag}-lazienka.jpg`, `${runTag}-salon.jpg`]) {
      // Raw INSERT, not payload.create: an upload through Payload would push bytes at the Blob
      // store for a fixture nothing ever opens.
      const { rows } = await db.execute(sql`
        INSERT INTO media (filename, mime_type, filesize, kind)
        VALUES (${filename}, 'image/jpeg', 1024, 'zdjecie')
        RETURNING id
      `)
      mediaIds.push(Number(rows[0].id))
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
      assets: mediaIds,
      rawData: [{ name: 'metraz', values: ['30-60 m2'] }],
    })
    createdIds.push(lead.id)

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
