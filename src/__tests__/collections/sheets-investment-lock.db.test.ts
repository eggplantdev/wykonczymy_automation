import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'

// The unit spec sees only the `Where` the gate returns; whether it reaches the right rows is a
// question about Postgres. `investment` is nullable, and a sheet naming none („Nowy kosztorys" makes
// one) must stay editable — `not_equals` keeps it, `not_in` would not.

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = 'EX-770'

describe.skipIf(!ENV_READY)('kosztoryses under the investment lock (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let manager: Awaited<ReturnType<Payload['create']>>
  let owner: Awaited<ReturnType<Payload['create']>>
  let lockedInvestmentId: number
  let openInvestmentId: number
  // One locked investment owning NO sheet per inbound case: aiming at `lockedInvestmentId` would be
  // refused by the 1:1 partial unique index before the gate is asked, and two cases sharing one target
  // would leave the second leaning on the first one's refusal — green with the gate reverted.
  const lockedEmpty: Record<'repoint' | 'link' | 'create', number> = {
    repoint: 0,
    link: 0,
    create: 0,
  }
  let openEmptyInvestmentId: number
  // One sheet per case that CONSUMES its fixture, so no `it` here depends on another one's order.
  const sheets: Record<'locked' | 'open' | 'unlinked' | 'spare', number> = {
    locked: 0,
    open: 0,
    unlinked: 0,
    spare: 0,
  }
  const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

  async function makeSheet(key: keyof typeof sheets, investment?: number): Promise<void> {
    const created = await payload.create({
      collection: 'kosztoryses',
      data: { name: `${MARKER} ${key}`, googleSheetId: `${MARKER}-${key}-sheet`, investment },
      overrideAccess: true,
      ...ctx,
    })
    sheets[key] = Number(created.id)
  }

  async function investmentOf(id: number): Promise<number | null> {
    const result = await db.execute(sql`SELECT investment_id FROM kosztoryses WHERE id = ${id}`)
    const value = result.rows[0]?.investment_id
    return value === null || value === undefined ? null : Number(value)
  }

  async function nameOf(id: number): Promise<string> {
    const result = await db.execute(sql`SELECT name FROM kosztoryses WHERE id = ${id}`)
    return String(result.rows[0]?.name)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    // A crashed run leaves fixtures in a database every other spec queries. Sheets and users are caught
    // by their unique keys; the investments are not, so they have to be swept by name.
    await db.execute(sql`DELETE FROM kosztoryses WHERE google_sheet_id LIKE ${`${MARKER}-%`}`)
    await purgeFixtureUsers(db)
    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${MARKER} %investment%`}`)

    const makeUser = (role: 'MANAGER' | 'OWNER') =>
      payload.create({
        collection: 'users',
        data: {
          name: `EX-770 ${role}`,
          role,
          email: `${MARKER}-${role.toLowerCase()}@test.local`,
          password: 'test-password-123',
        },
        ...ctx,
      })
    ;[manager, owner] = await Promise.all([makeUser('MANAGER'), makeUser('OWNER')])
    ;[
      lockedInvestmentId,
      openInvestmentId,
      lockedEmpty.repoint,
      lockedEmpty.link,
      lockedEmpty.create,
      openEmptyInvestmentId,
    ] = await Promise.all([
      createTestInvestment(payload, `${MARKER} locked investment`),
      createTestInvestment(payload, `${MARKER} open investment`),
      createTestInvestment(payload, `${MARKER} locked empty repoint investment`),
      createTestInvestment(payload, `${MARKER} locked empty link investment`),
      createTestInvestment(payload, `${MARKER} locked empty create investment`),
      createTestInvestment(payload, `${MARKER} open empty investment`),
    ])

    await Promise.all([
      makeSheet('locked', lockedInvestmentId),
      makeSheet('open', openInvestmentId),
      makeSheet('unlinked'),
      makeSheet('spare'),
    ])

    await Promise.all(
      [lockedInvestmentId, lockedEmpty.repoint, lockedEmpty.link, lockedEmpty.create].map((id) =>
        payload.update({
          collection: 'investments',
          id,
          data: { status: LOCKED_INVESTMENT_STATUS },
          overrideAccess: true,
          ...ctx,
        }),
      ),
    )
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM kosztoryses WHERE google_sheet_id LIKE ${`${MARKER}-%`}`)
    for (const id of [
      lockedInvestmentId,
      openInvestmentId,
      lockedEmpty.repoint,
      lockedEmpty.link,
      lockedEmpty.create,
      openEmptyInvestmentId,
    ]) {
      if (!id) continue
      // Raw SQL: reopening a zakończona inwestycja through Payload needs the status hook's blessing.
      await db.execute(sql`UPDATE investments SET status = 'active' WHERE id = ${id}`)
      await deleteTestInvestment(payload, id)
    }
    await purgeFixtureUsers(db)
  })

  it('refuses a panel update on a sheet of a zakończona inwestycja', async () => {
    await expect(
      payload.update({
        collection: 'kosztoryses',
        id: sheets.locked,
        data: { name: `${MARKER} renamed` },
        user: manager,
        overrideAccess: false,
        ...ctx,
      }),
    ).rejects.toThrow()
    expect(await nameOf(sheets.locked)).toBe(`${MARKER} locked`)
  })

  it('leaves a sheet of an open investment editable', async () => {
    await payload.update({
      collection: 'kosztoryses',
      id: sheets.open,
      data: { name: `${MARKER} open renamed` },
      user: manager,
      overrideAccess: false,
      ...ctx,
    })
    expect(await nameOf(sheets.open)).toBe(`${MARKER} open renamed`)
  })

  // An unlinked sheet has no status to compare against, and renaming or deleting one exists only in
  // `/admin` — gate it and it is unrecoverable in-app.
  it('leaves a sheet that names no investment editable', async () => {
    await payload.update({
      collection: 'kosztoryses',
      id: sheets.unlinked,
      data: { name: `${MARKER} unlinked renamed` },
      user: manager,
      overrideAccess: false,
      ...ctx,
    })
    expect(await nameOf(sheets.unlinked)).toBe(`${MARKER} unlinked renamed`)
  })

  // The direction a stored-row `Where` cannot see. Land the row on a zakończona inwestycja and it is
  // stuck there: the panel then reads it as locked and the action layer refuses too.
  it('refuses re-pointing an open sheet AT a zakończona inwestycja', async () => {
    await expect(
      payload.update({
        collection: 'kosztoryses',
        id: sheets.open,
        data: { investment: lockedEmpty.repoint },
        user: manager,
        overrideAccess: false,
        ...ctx,
      }),
    ).rejects.toThrow()
    expect(await investmentOf(sheets.open)).toBe(openInvestmentId)
  })

  it('refuses linking an unlinked sheet to a zakończona inwestycja', async () => {
    await expect(
      payload.update({
        collection: 'kosztoryses',
        id: sheets.unlinked,
        data: { investment: lockedEmpty.link },
        user: manager,
        overrideAccess: false,
        ...ctx,
      }),
    ).rejects.toThrow()
    expect(await investmentOf(sheets.unlinked)).toBeNull()
  })

  it('refuses an OWNER delete on a sheet of a zakończona inwestycja', async () => {
    await expect(
      payload.delete({
        collection: 'kosztoryses',
        id: sheets.locked,
        user: owner,
        overrideAccess: false,
        ...ctx,
      }),
    ).rejects.toThrow()
    expect(await nameOf(sheets.locked)).toBe(`${MARKER} locked`)
  })

  // The same trap `investment-lock.ts` names, seen through the wiring rather than the factory.
  it('still refuses a MANAGER delete on a sheet nothing locks', async () => {
    await expect(
      payload.delete({
        collection: 'kosztoryses',
        id: sheets.spare,
        user: manager,
        overrideAccess: false,
        ...ctx,
      }),
    ).rejects.toThrow()
    // The refusal has to be read off the row, not off the rejection: a delete that threw AFTER
    // removing the row would satisfy `rejects.toThrow()` just as well.
    expect(await nameOf(sheets.spare)).toBe(`${MARKER} spare`)
  })

  // The `create` arm reads the INCOMING investment, so only a real create through the collection
  // proves the factory is wired to the right relationship name.
  it('refuses creating a sheet on a zakończona inwestycja', async () => {
    await expect(
      payload.create({
        collection: 'kosztoryses',
        data: {
          name: `${MARKER} born locked`,
          googleSheetId: `${MARKER}-born-locked-sheet`,
          investment: lockedEmpty.create,
        },
        user: manager,
        overrideAccess: false,
        ...ctx,
      }),
    ).rejects.toThrow()
    const rows = await db.execute(
      sql`SELECT id FROM kosztoryses WHERE google_sheet_id = ${`${MARKER}-born-locked-sheet`}`,
    )
    expect(rows.rows).toHaveLength(0)
  })

  it('lets a MANAGER create a sheet on an open investment', async () => {
    const created = await payload.create({
      collection: 'kosztoryses',
      data: {
        name: `${MARKER} born open`,
        googleSheetId: `${MARKER}-born-open-sheet`,
        investment: openEmptyInvestmentId,
      },
      user: manager,
      overrideAccess: false,
      ...ctx,
    })
    expect(created.id).toBeDefined()
  })

  it('lets an OWNER delete a sheet that names no investment', async () => {
    await payload.delete({
      collection: 'kosztoryses',
      id: sheets.unlinked,
      user: owner,
      overrideAccess: false,
      ...ctx,
    })
    const rows = await db.execute(sql`SELECT id FROM kosztoryses WHERE id = ${sheets.unlinked}`)
    expect(rows.rows).toHaveLength(0)
  })
})
