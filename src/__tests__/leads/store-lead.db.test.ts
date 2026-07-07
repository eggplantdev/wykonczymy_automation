import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'

// The leads collection's afterChange hook calls revalidateTag, which throws outside a
// Next request context. Stub it — cache invalidation is not under test here.
vi.mock('next/cache', () => ({ revalidateTag: () => {}, updateTag: () => {} }))

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
  isTest: true,
})

describe.skipIf(!ENV_READY)('storeLead + captureLead (DB)', () => {
  let payload: Payload
  const createdIds: number[] = []

  beforeAll(async () => {
    process.env.LEADS_NOTIFY_EMAIL ??= 'inbox@example.com'
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
  })

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
})
