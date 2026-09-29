import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { entityTag } from '@/lib/cache/tags'
import { getPresetName } from '@/lib/db/presets'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { createTestTemplate } from '@/__tests__/helpers/template'
import { revalidateCollections, revalidateEntities } from '@/__tests__/stubs/cache-revalidate'

// Asserted on persisted rows: a trash that reports success but never stamps `trashed_at`, or a
// delete that leaves kosztorys rows behind, reads identically at the action's return value. The
// session is mocked rather than `requireAuth`, so the role gate under test is the real one.

vi.mock('server-only', () => ({}))

const { session } = vi.hoisted(() => ({ session: { role: 'OWNER' } }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: vi.fn(async () => ({ id: 1, role: session.role, name: 'T', email: 't@t.pl' })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = 'kosz-inwestycji trash-actions'

describe.skipIf(!ENV_READY)('investment trash actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/investment-trash')

  const purge = async () => {
    await db.execute(sql`
      DELETE FROM transactions WHERE investment_id IN
        (SELECT id FROM investments WHERE name LIKE ${`${PREFIX}%`})
    `)
    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${PREFIX}%`}`)
  }

  const trashedAt = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT trashed_at FROM investments WHERE id = ${id}`)
    return rows[0]?.trashed_at ?? null
  }

  const countRows = async (table: 'kosztorys_items' | 'kosztorys_shares', id: number) => {
    const { rows } = await db.execute(
      sql`SELECT count(*)::int AS n FROM ${sql.raw(table)} WHERE investment_id = ${id}`,
    )
    return Number(rows[0].n)
  }

  const countProgress = async (itemId: number) => {
    const { rows } = await db.execute(
      sql`SELECT count(*)::int AS n FROM stage_progress WHERE item_id = ${itemId}`,
    )
    return Number(rows[0].n)
  }

  const insertTransaction = (investmentId: number, cancelled: boolean) =>
    db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, cancelled)
      VALUES (${PREFIX}, 1000, now(), 'LABOR_COST'::enum_transactions_type, 'TRANSFER',
        ${investmentId}, ${cancelled})
    `)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/investment-trash')
    await purge()
  })

  beforeEach(() => {
    session.role = 'OWNER'
    revalidateEntities.mockClear()
    revalidateCollections.mockClear()
  })

  afterAll(purge)

  it('lets a MANAGER trash, restore and delete forever', async () => {
    const id = await createTestInvestment(payload, `${PREFIX} manager`)
    session.role = 'MANAGER'

    expect((await actions.trashInvestmentAction(id)).success).toBe(true)
    expect(await trashedAt(id)).not.toBeNull()

    expect((await actions.restoreInvestmentAction(id)).success).toBe(true)
    expect(await trashedAt(id)).toBeNull()

    expect((await actions.trashInvestmentAction(id)).success).toBe(true)
    expect((await actions.deleteInvestmentForeverAction(id)).success).toBe(true)
    const { rows } = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${id}`)
    expect(rows).toHaveLength(0)
  })

  it('refuses an EMPLOYEE every trash action', async () => {
    const live = await createTestInvestment(payload, `${PREFIX} employee-live`)
    const trashed = await createTestInvestment(payload, `${PREFIX} employee-trashed`)
    await actions.trashInvestmentAction(trashed)
    session.role = 'EMPLOYEE'

    expect((await actions.trashInvestmentAction(live)).success).toBe(false)
    expect((await actions.restoreInvestmentAction(trashed)).success).toBe(false)
    expect((await actions.deleteInvestmentForeverAction(trashed)).success).toBe(false)

    expect(await trashedAt(live)).toBeNull()
    expect(await trashedAt(trashed)).not.toBeNull()
  })

  it('lets a MANAGER trash and restore a szablon, expiring the szablon library', async () => {
    const template = await createTestTemplate(payload, `${PREFIX} szablon`)
    session.role = 'MANAGER'

    expect((await actions.trashInvestmentAction(template)).success).toBe(true)
    expect(await trashedAt(template)).not.toBeNull()
    expect(revalidateCollections.mock.calls.flatMap(([tags]) => tags)).toContain('presets')

    expect((await actions.restoreInvestmentAction(template)).success).toBe(true)
    expect(await trashedAt(template)).toBeNull()
  })

  it('demands the name before deleting a szablon forever, even an empty one', async () => {
    const template = await createTestTemplate(payload, `${PREFIX} szablon-forever`)
    const name = (await getPresetName(db, template))!
    await actions.trashInvestmentAction(template)

    for (const typed of [undefined, 'zła nazwa']) {
      expect(await actions.deleteInvestmentForeverAction(template, typed)).toEqual({
        success: false,
        error: 'Wpisana nazwa się nie zgadza.',
      })
    }
    expect(await trashedAt(template)).not.toBeNull()

    expect((await actions.deleteInvestmentForeverAction(template, name)).success).toBe(true)
    const left = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${template}`)
    expect(left.rows).toHaveLength(0)
  })

  it('refuses while a live transaction points at the investment, not a cancelled one', async () => {
    const live = await createTestInvestment(payload, `${PREFIX} live-transaction`)
    await insertTransaction(live, false)
    const cancelled = await createTestInvestment(payload, `${PREFIX} cancelled-transaction`)
    await insertTransaction(cancelled, true)

    const refused = await actions.trashInvestmentAction(live)
    const allowed = await actions.trashInvestmentAction(cancelled)

    expect(refused.success).toBe(false)
    expect(refused.success === false && refused.error).toMatch(/Nie można usunąć inwestycji/)
    expect(await trashedAt(live)).toBeNull()
    expect(allowed.success).toBe(true)
    expect(await trashedAt(cancelled)).not.toBeNull()
  })

  it('round-trips trash and restore without touching the kosztorys', async () => {
    const id = await createTestInvestment(payload, `${PREFIX} round-trip`)
    await createKosztorysTree(payload, id, {
      sections: [{ name: 'S', items: [{ plannedQty: 2 }, { plannedQty: 5 }] }],
    })

    expect((await actions.trashInvestmentAction(id)).success).toBe(true)
    expect(await trashedAt(id)).not.toBeNull()
    expect(revalidateEntities).toHaveBeenCalledWith(
      [entityTag('investment', id)],
      expect.anything(),
    )

    expect((await actions.restoreInvestmentAction(id)).success).toBe(true)
    expect(await trashedAt(id)).toBeNull()
    expect(await countRows('kosztorys_items', id)).toBe(2)
  })

  it('refuses to delete forever an investment that is not in the trash', async () => {
    const id = await createTestInvestment(payload, `${PREFIX} not-trashed`)

    const result = await actions.deleteInvestmentForeverAction(id)

    expect(result).toEqual({ success: false, error: 'Najpierw przenieś inwestycję do kosza.' })
    expect(await countRows('kosztorys_items', id)).toBe(0)
    const { rows } = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${id}`)
    expect(rows).toHaveLength(1)
  })

  it('demands the name for a used kosztorys, then deletes it with everything under it', async () => {
    const name = `${PREFIX} used`
    const id = await createTestInvestment(payload, name)
    const { itemIds } = await createKosztorysTree(payload, id, {
      sections: [{ name: 'S', items: [{ plannedQty: 4 }] }],
      stages: [{}],
      progress: [{ item: 0, stage: 0, qtyDone: 1 }],
    })
    await payload.create({
      collection: 'kosztorys-shares',
      data: { investment: id, token: `${PREFIX}-token-${id}` },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    await actions.trashInvestmentAction(id)

    const withoutName = await actions.deleteInvestmentForeverAction(id)
    const wrongName = await actions.deleteInvestmentForeverAction(id, 'inna nazwa')

    expect(withoutName.success).toBe(false)
    expect(wrongName.success).toBe(false)
    expect(await countRows('kosztorys_items', id)).toBe(1)

    const deleted = await actions.deleteInvestmentForeverAction(id, `  ${name} `)

    expect(deleted.success).toBe(true)
    const { rows } = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${id}`)
    expect(rows).toHaveLength(0)
    expect(await countRows('kosztorys_items', id)).toBe(0)
    expect(await countRows('kosztorys_shares', id)).toBe(0)
    expect(await countProgress(itemIds[0])).toBe(0)
  })

  it('deletes an unused kosztorys without asking for the name', async () => {
    const id = await createTestInvestment(payload, `${PREFIX} unused`)
    await createKosztorysTree(payload, id, {
      sections: [{ name: 'S', items: [{ plannedQty: 0, clientPrice: 80 }] }],
    })
    await actions.trashInvestmentAction(id)

    const result = await actions.deleteInvestmentForeverAction(id)

    expect(result.success).toBe(true)
    expect(await countRows('kosztorys_items', id)).toBe(0)
  })
})
