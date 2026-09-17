import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { gcSnapshots, getSnapshot, insertSnapshot, listSnapshots } from '@/lib/db/snapshots'
import { deletePreset, insertPreset } from '@/lib/db/presets'
import { setWorkshopPreset } from '@/lib/db/workshop-investment'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { acquireTestWorkshop } from '@/__tests__/helpers/workshop'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const emptyPayload: SnapshotPayloadT = {
  schemaVersion: 1,
  sections: [],
  items: [],
  stages: [],
  progress: [],
  settings: {
    wToolsCoeff: 0,
    ownToolsCoeff: 0,
    vatRate: 0,
  },
}

// gcSnapshots thins in raw SQL, so the only real assertion is which rows survive. The mistake worth
// guarding is dropping `investment_id` from the PARTITION BY — it keeps ONE row across every
// investment and is invisible to a single-investment fixture. Hence two investments below.
describe.skipIf(!ENV_READY)('gcSnapshots retention bands (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    investmentId = await createTestInvestment(payload, 'gc-snapshots-test')
    otherInvestmentId = await createTestInvestment(payload, 'gc-snapshots-other')
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    if (otherInvestmentId) await deleteTestInvestment(payload, otherInvestmentId)
  })

  // Backdate to a FIXED wall-clock point, not an offset from now(): "same day, three hours apart"
  // straddles midnight on a pre-03:00 run, and a sub-week offset lands in one week or two depending
  // on the weekday. Anchoring on the sweep's own date_trunc asserts the bucketing, not the clock.
  async function insertAt(
    targetInvestmentId: number,
    kind: 'auto' | 'manual',
    daysAgo: number,
    hour: number,
  ): Promise<number> {
    const id = await insertSnapshot(db, {
      investmentId: targetInvestmentId,
      kind,
      label: kind === 'manual' ? 'wersja' : null,
      takenBy: null,
      payload: emptyPayload,
    })
    await db.execute(sql`
      UPDATE kosztorys_snapshots SET taken_at = (
        date_trunc('day', now() AT TIME ZONE 'Europe/Warsaw')
          - make_interval(days => ${daysAgo})
          + make_interval(hours => ${hour})
      ) AT TIME ZONE 'Europe/Warsaw'
      WHERE id = ${id}
    `)
    return id
  }

  // Two rows on different days of one week is the only fixture that tells date_trunc('week') from
  // date_trunc('day') — day-aligned rows only, and a band truncating by day keeps both and passes.
  async function insertInWeek(weeksAgo: number, dayInWeek: number, hour: number): Promise<number> {
    const id = await insertSnapshot(db, {
      investmentId,
      kind: 'auto',
      label: null,
      takenBy: null,
      payload: emptyPayload,
    })
    await db.execute(sql`
      UPDATE kosztorys_snapshots SET taken_at = (
        date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw')
          - make_interval(weeks => ${weeksAgo})
          + make_interval(days => ${dayInWeek}, hours => ${hour})
      ) AT TIME ZONE 'Europe/Warsaw'
      WHERE id = ${id}
    `)
    return id
  }

  async function survivorsOf(targetInvestmentId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT id FROM kosztorys_snapshots WHERE investment_id = ${targetInvestmentId} ORDER BY id`,
    )
    return res.rows.map((row) => Number(row.id))
  }

  it('keeps full density for 30 days, one per day to 120, one per week to 365, and is idempotent', async () => {
    // Every age sits clear of a band edge (30 / 120 / 365): the backdating UPDATE and the sweep's
    // now() are separate transactions, so a row placed exactly on an edge races.

    // Inside the full-density window — two rows on one day, both survive.
    const freshEarly = await insertAt(investmentId, 'auto', 2, 8)
    const freshLate = await insertAt(investmentId, 'auto', 2, 19)

    // Daily band — three rows on day 40 collapse to the newest; day 41 keeps its own.
    const day40Morning = await insertAt(investmentId, 'auto', 40, 2)
    const day40Noon = await insertAt(investmentId, 'auto', 40, 10)
    const day40Evening = await insertAt(investmentId, 'auto', 40, 20)
    const day41 = await insertAt(investmentId, 'auto', 41, 12)

    // Weekly band — Tuesday and Thursday of the same week (29 weeks back, well past 120 days)
    // collapse to the Thursday row, which is what proves the bucket is a week and not a day.
    const sameWeekEarlier = await insertInWeek(29, 1, 5)
    const sameWeekLater = await insertInWeek(29, 3, 15)
    const previousWeek = await insertInWeek(30, 3, 9)

    // Manual rows under the ceiling survive both bands — the bands are kind = 'auto' only. One in
    // each band, because a `kind` filter dropped from just one DELETE would still leave the other green.
    const manualInDailyBand = await insertAt(investmentId, 'manual', 40, 6)
    const manualInWeeklyBand = await insertAt(investmentId, 'manual', 200, 11)

    // Both kinds past the ceiling.
    const ancientAuto = await insertAt(investmentId, 'auto', 400, 9)
    const ancientManual = await insertAt(investmentId, 'manual', 400, 9)

    // A second investment with rows in the SAME calendar day as the daily-band fixture above.
    const otherDay40Morning = await insertAt(otherInvestmentId, 'auto', 40, 3)
    const otherDay40Evening = await insertAt(otherInvestmentId, 'auto', 40, 21)

    const first = await gcSnapshots(db)
    expect(first.daily).toBeGreaterThanOrEqual(3)
    expect(first.weekly).toBeGreaterThanOrEqual(1)
    expect(first.ceiling).toBeGreaterThanOrEqual(2)

    const survivors = await survivorsOf(investmentId)
    expect(survivors).toEqual(
      [
        freshEarly,
        freshLate,
        day40Evening,
        day41,
        sameWeekLater,
        previousWeek,
        manualInDailyBand,
        manualInWeeklyBand,
      ].sort((a, b) => a - b),
    )
    expect(survivors).not.toContain(day40Morning)
    expect(survivors).not.toContain(day40Noon)
    expect(survivors).not.toContain(sameWeekEarlier)
    expect(survivors).not.toContain(ancientAuto)
    expect(survivors).not.toContain(ancientManual)

    // The other investment keeps ITS OWN newest row for that day — not zero, and not the same
    // row as the first investment's
    const otherSurvivors = await survivorsOf(otherInvestmentId)
    expect(otherSurvivors).toEqual([otherDay40Evening])
    expect(otherSurvivors).not.toContain(otherDay40Morning)

    // Idempotent: a second sweep has nothing left to thin. Asserted as survivor stability rather than
    // `deleted === 0`, because the sweep covers the whole table — a neighbouring run's leftovers count.
    await gcSnapshots(db)
    expect(await survivorsOf(investmentId)).toEqual(survivors)
    expect(await survivorsOf(otherInvestmentId)).toEqual(otherSurvivors)
  })
})

// The warsztat is ONE investment serving every szablon, so the szablon scopes a restore point, not
// `investment_id`. Filtering only the drawer would be cosmetic — a stale tab still holds another
// szablon's ids, and restoring one then saving writes it into the szablon now open. Hence both the
// list and the by-id read carry the clause, asserted here on the rows.
describe.skipIf(!ENV_READY)('szablon-scoped restore points (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workshop: Awaited<ReturnType<typeof acquireTestWorkshop>>
  let plainInvestmentId: number
  let presetA: number
  let presetB: number
  let pointUnderA: number
  let pointUnderB: number
  let plainPoint: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const ids = await Promise.all(
      ['snapshot-scope-a', 'snapshot-scope-b'].map((name) =>
        insertPreset(db, { name, createdBy: null, payload: emptyPayload }),
      ),
    )
    if (ids.some((id) => id == null)) throw new Error('fixture presets already exist — stale run?')
    ;[presetA, presetB] = ids as number[]

    workshop = await acquireTestWorkshop(payload)
    const take = () =>
      insertSnapshot(db, {
        investmentId: workshop.id,
        kind: 'manual',
        label: null,
        takenBy: null,
        payload: emptyPayload,
      })

    await setWorkshopPreset(db, workshop.id, presetA)
    pointUnderA = await take()
    await setWorkshopPreset(db, workshop.id, presetB)
    pointUnderB = await take()

    plainInvestmentId = await createTestInvestment(payload, 'snapshot-scope-plain')
    plainPoint = await insertSnapshot(db, {
      investmentId: plainInvestmentId,
      kind: 'manual',
      label: null,
      takenBy: null,
      payload: emptyPayload,
    })
  })

  afterAll(async () => {
    await db.execute(
      sql`DELETE FROM kosztorys_snapshots WHERE id IN (${pointUnderA}, ${pointUnderB}, ${plainPoint})`,
    )
    await workshop.release()
    await Promise.all([deletePreset(db, presetA), deletePreset(db, presetB)])
    if (plainInvestmentId) await deleteTestInvestment(payload, plainInvestmentId)
  })

  it('lists only the points taken under the szablon the warsztat holds now', async () => {
    const ids = (await listSnapshots(db, workshop.id)).map((s) => s.id)

    expect(ids).toContain(pointUnderB)
    expect(ids).not.toContain(pointUnderA)
  })

  it('refuses to load a point belonging to another szablon by id', async () => {
    expect(await getSnapshot(db, pointUnderA)).toBeNull()
    expect(await getSnapshot(db, pointUnderB)).not.toBeNull()
  })

  it('leaves a normal investment its whole history', async () => {
    // Both sides of the clause are NULL off the warsztat, so the szablon rule must not narrow
    // anything here — a kosztorys losing its versions would be the expensive way to get this wrong.
    expect((await listSnapshots(db, plainInvestmentId)).map((s) => s.id)).toEqual([plainPoint])
    expect(await getSnapshot(db, plainPoint)).not.toBeNull()
  })
})
