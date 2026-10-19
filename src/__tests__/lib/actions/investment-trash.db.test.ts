import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { entityTag } from '@/lib/cache/tags'
import { createTestInvestment, trashDaysAgo } from '@/__tests__/helpers/investment'
import {
  ACTIVE_INVESTMENT_DELETE_MESSAGE,
  TRASHED_ACTIVE_INVESTMENT_DELETE_MESSAGE,
} from '@/lib/constants/trash'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { revalidateCollections, revalidateEntities } from '@/__tests__/stubs/cache-revalidate'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { describeTrashContract } from '@/__tests__/helpers/trash-contract'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

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

  // Not the helper's `active` default: an active investment is exactly what the trash refuses.
  const createInvestment = (name: string) =>
    createTestInvestment(payload, name, { status: 'quote' })

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
    payload = await bootTestPayload()
    db = await getDb(payload)
    actions = await import('@/lib/actions/investment-trash')
    await purge()
  })

  beforeEach(() => {
    authState.role = 'OWNER'
    revalidateEntities.mockClear()
    revalidateCollections.mockClear()
  })

  afterAll(purge)

  describeTrashContract({
    table: 'investments',
    nameColumn: 'name',
    prefix: `${PREFIX} kontrakt`,
    create: async (contractPayload, name) => ({
      id: await createTestInvestment(contractPayload, name, { status: 'quote' }),
    }),
    addChild: (contractPayload, investmentId) =>
      createKosztorysTree(contractPayload, investmentId, {
        sections: [{ name: 'S', items: [{ plannedQty: 2 }] }],
      }),
    childTable: 'kosztorys_items',
    childForeignKey: 'investment_id',
    loadActions: async () => {
      const trashActions = await import('@/lib/actions/investment-trash')
      return {
        trash: trashActions.trashInvestmentAction,
        restore: trashActions.restoreInvestmentAction,
        deleteForever: trashActions.deleteInvestmentForeverAction,
      }
    },
    setRole: (role) => {
      authState.role = role
    },
    missingError: 'Inwestycja nie istnieje.',
    notInTrashError: 'Najpierw przenieś inwestycję do kosza.',
    revalidated: {
      trash: ['investments'],
      deleteForever: [
        'investments',
        'kosztoryses',
        'kosztorysSections',
        'kosztorysItems',
        'kosztorysStages',
        'stageProgress',
        'transfers',
        'equipmentEvents',
      ],
    },
  })

  it('refuses an EMPLOYEE every trash action', async () => {
    const live = await createInvestment(`${PREFIX} employee-live`)
    const trashed = await createInvestment(`${PREFIX} employee-trashed`)
    await actions.trashInvestmentAction(trashed)
    authState.role = 'EMPLOYEE'

    expect((await actions.trashInvestmentAction(live)).success).toBe(false)
    expect((await actions.restoreInvestmentAction(trashed)).success).toBe(false)
    expect(
      (await actions.deleteInvestmentForeverAction(trashed, `${PREFIX} employee-trashed`)).success,
    ).toBe(false)

    expect(await trashedAt(live)).toBeNull()
    expect(await trashedAt(trashed)).not.toBeNull()
  })

  it('refuses while a live transaction points at the investment, not a cancelled one', async () => {
    const live = await createInvestment(`${PREFIX} live-transaction`)
    await insertTransaction(live, false)
    const cancelled = await createInvestment(`${PREFIX} cancelled-transaction`)
    await insertTransaction(cancelled, true)

    const refused = await actions.trashInvestmentAction(live)
    const allowed = await actions.trashInvestmentAction(cancelled)

    expect(refused.success).toBe(false)
    expect(refused.success === false && refused.error).toMatch(/Nie można usunąć inwestycji/)
    expect(await trashedAt(live)).toBeNull()
    expect(allowed.success).toBe(true)
    expect(await trashedAt(cancelled)).not.toBeNull()
  })

  it('refuses to trash an active investment', async () => {
    const id = await createTestInvestment(payload, `${PREFIX} active`, { status: 'active' })

    const result = await actions.trashInvestmentAction(id)

    expect(result).toEqual({ success: false, error: ACTIVE_INVESTMENT_DELETE_MESSAGE })
    expect(await trashedAt(id)).toBeNull()
  })

  it('refuses to delete forever an active investment that reached the trash before the rule', async () => {
    const id = await createTestInvestment(payload, `${PREFIX} active-trashed`, {
      status: 'active',
    })
    await trashDaysAgo(db, id, 1)

    const result = await actions.deleteInvestmentForeverAction(id, `${PREFIX} active-trashed`)

    expect(result).toEqual({ success: false, error: TRASHED_ACTIVE_INVESTMENT_DELETE_MESSAGE })
    const { rows } = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${id}`)
    expect(rows).toHaveLength(1)
  })

  it('round-trips trash and restore without touching the kosztorys', async () => {
    const id = await createInvestment(`${PREFIX} round-trip`)
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

  it('demands the name for a used kosztorys, then deletes it with everything under it', async () => {
    const name = `${PREFIX} used`
    const id = await createInvestment(name)
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

    const withoutName = await actions.deleteInvestmentForeverAction(id, '')
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

  it('demands the name for an unused kosztorys too', async () => {
    const name = `${PREFIX} unused`
    const id = await createInvestment(name)
    await createKosztorysTree(payload, id, {
      sections: [{ name: 'S', items: [{ plannedQty: 0, clientPrice: 80 }] }],
    })
    await actions.trashInvestmentAction(id)

    expect(await actions.deleteInvestmentForeverAction(id, '')).toEqual({
      success: false,
      error: 'Wpisana nazwa się nie zgadza.',
    })
    expect(await countRows('kosztorys_items', id)).toBe(1)

    expect((await actions.deleteInvestmentForeverAction(id, name)).success).toBe(true)
    expect(await countRows('kosztorys_items', id)).toBe(0)
  })
})
