import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { TRASH_RETENTION_DAYS } from '@/lib/constants/investment-lock'
import { getDb } from '@/lib/db/get-db'
import {
  createTestInvestment,
  PAST_RETENTION_DAYS,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { createTestTemplate } from '@/__tests__/helpers/template'

// The /kosz label and the purge read one „realnie użyty" fragment; if it misjudged a template seed
// as used, nothing would ever purge, and if it missed a Pomiar typed on an etap with Przedmiar 0,
// the cron would delete measured work without the owner typing its name.

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = 'kosz-inwestycji trash-db'

describe.skipIf(!ENV_READY)('investment trash queries (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let trash: typeof import('@/lib/db/investment-trash')
  let planned: number
  let measured: number
  let priceOnly: number
  let empty: number
  let fresh: number
  let template: number

  const purge = () => db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${PREFIX}%`}`)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    trash = await import('@/lib/db/investment-trash')
    await purge()

    planned = await createTestInvestment(payload, `${PREFIX} planned`)
    await createKosztorysTree(payload, planned, {
      sections: [{ name: 'S', items: [{ plannedQty: 3 }] }],
    })

    measured = await createTestInvestment(payload, `${PREFIX} measured`)
    await createKosztorysTree(payload, measured, {
      sections: [{ name: 'S', items: [{ plannedQty: 0 }] }],
      stages: [{}],
      progress: [{ item: 0, stage: 0, qtyDone: 2 }],
    })

    priceOnly = await createTestInvestment(payload, `${PREFIX} price-only`)
    await createKosztorysTree(payload, priceOnly, {
      sections: [{ name: 'S', items: [{ plannedQty: 0, clientPrice: 120, discountValue: 10 }] }],
      stages: [{}],
      progress: [{ item: 0, stage: 0, qtyDone: 0 }],
    })

    empty = await createTestInvestment(payload, `${PREFIX} empty`)
    fresh = await createTestInvestment(payload, `${PREFIX} fresh`)

    template = await createTestTemplate(payload, `${PREFIX} szablon`)
    await createKosztorysTree(payload, template, {
      sections: [{ name: 'S', items: [{ plannedQty: 0, clientPrice: 90 }] }],
    })

    for (const id of [planned, measured, priceOnly, empty, template])
      await trashDaysAgo(db, id, PAST_RETENTION_DAYS)
    await trashDaysAgo(db, fresh, WITHIN_RETENTION_DAYS)
  })

  afterAll(purge)

  it('counts a typed Przedmiar as used', async () => {
    expect(await trash.isKosztorysUsed(db, planned)).toBe(true)
  })

  it('counts work measured on an etap as used, even with Przedmiar 0', async () => {
    expect(await trash.isKosztorysUsed(db, measured)).toBe(true)
  })

  it('does not count price, rabat or a zero pomiar as used', async () => {
    expect(await trash.isKosztorysUsed(db, priceOnly)).toBe(false)
    expect(await trash.isKosztorysUsed(db, empty)).toBe(false)
  })

  it('purges only unused investments past retention, and counts the used ones it skipped', async () => {
    const { purgeable, skippedKosztorys } = await trash.selectPurgeableInvestmentIds(
      db,
      TRASH_RETENTION_DAYS,
    )
    const ours = new Set([planned, measured, priceOnly, empty, fresh, template])

    expect(purgeable.filter((id) => ours.has(id)).sort()).toEqual(
      [priceOnly, empty, template].sort(),
    )
    expect(skippedKosztorys).toBeGreaterThanOrEqual(2)
  })

  it('lists the trash newest first, with the same used flag', async () => {
    const rows = (await trash.fetchTrashedInvestments(db)).filter((row) =>
      row.name.startsWith(PREFIX),
    )

    expect(rows[0].id).toBe(fresh)
    expect(rows.find((row) => row.id === planned)?.isKosztorysUsed).toBe(true)
    expect(rows.find((row) => row.id === priceOnly)?.isKosztorysUsed).toBe(false)
  })

  it('tells a szablon apart from an investment, so /kosz can section them', async () => {
    const rows = (await trash.fetchTrashedInvestments(db)).filter((row) =>
      row.name.startsWith(PREFIX),
    )

    expect(rows.find((row) => row.id === template)?.isTemplate).toBe(true)
    expect(rows.find((row) => row.id === priceOnly)?.isTemplate).toBe(false)
  })
})
