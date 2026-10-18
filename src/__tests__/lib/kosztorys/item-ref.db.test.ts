import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { appendAt } from '@/__tests__/helpers/new-item-input'
import { authState } from '@/__tests__/stubs/require-auth'
import { firstUserId } from '@/__tests__/helpers/first-user-id'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

// The number printed on a fill-in form must survive every wipe-and-reinsert that is the SAME
// work (restore) and must never be reused by one that is new work (szablon, a new praca) — a reused
// number would resolve an old paper onto someone else's pozycja.
vi.mock('@/lib/auth/require-auth', () => import('@/__tests__/stubs/require-auth'))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { addItemAction } = await import('@/lib/actions/kosztorys')
const { serializeKosztorys } = await import('@/lib/kosztorys/serialize-kosztorys')
const { serializeKosztorysAsPreset } = await import('@/lib/kosztorys/serialize-preset')
const { restoreKosztorys } = await import('@/lib/kosztorys/restore-kosztorys')
const { applyPreset } = await import('@/lib/kosztorys/apply-preset')

const FIXTURE_PREFIX = 'item-ref-test-'

describe.skipIf(!ENV_READY)('kosztorys item ref (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let sourceId: number
  let targetId: number
  let sectionId: number

  const refsOf = async (investmentId: number) => {
    const res = await db.execute(sql`
      SELECT ref FROM kosztorys_items WHERE investment_id = ${investmentId} ORDER BY ref
    `)
    return res.rows.map((row) => Number(row.ref))
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)

    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${FIXTURE_PREFIX}%`}`)
    sourceId = await createTestInvestment(payload, `${FIXTURE_PREFIX}source-${Date.now()}`)
    targetId = await createTestInvestment(payload, `${FIXTURE_PREFIX}target-${Date.now()}`)

    const { sectionIds } = await createKosztorysTree(payload, sourceId, {
      sections: [
        {
          name: 'Sekcja A',
          items: [
            { description: 'Malowanie', unit: 'm2', plannedQty: 10, clientPrice: 100 },
            { description: 'Gruntowanie', unit: 'm2', plannedQty: 5, clientPrice: 40 },
          ],
        },
      ],
    })
    sectionId = sectionIds[0]!
  })

  afterAll(async () => {
    for (const id of [sourceId, targetId]) if (id) await deleteTestInvestment(payload, id)
  })

  it('restore writes every number back onto the reminted rows', async () => {
    const before = await serializeKosztorys(sourceId)
    const refsBefore = await refsOf(sourceId)

    await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, sourceId, before),
      { skipRevalidation: true },
    )

    const after = await serializeKosztorys(sourceId)
    expect(after.items.map((item) => item.id)).not.toEqual(before.items.map((item) => item.id))
    expect(await refsOf(sourceId)).toEqual(refsBefore)
  })

  it('a restored snapshot taken before the number existed draws fresh ones', async () => {
    const snapshot = await serializeKosztorys(sourceId)
    const refsBefore = await refsOf(sourceId)
    const legacy = { ...snapshot, items: snapshot.items.map(({ ref: _ref, ...item }) => item) }

    await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, sourceId, legacy),
      { skipRevalidation: true },
    )

    const refsAfter = await refsOf(sourceId)
    expect(refsAfter).toHaveLength(refsBefore.length)
    expect(refsAfter.some((ref) => refsBefore.includes(ref))).toBe(false)
  })

  it('„Wczytaj szablon" mints new numbers', async () => {
    const sourceRefs = await refsOf(sourceId)

    await withPayloadTransaction(
      payload,
      async (req) =>
        applyPreset(payload, req, targetId, await serializeKosztorysAsPreset(sourceId, req)),
      { skipRevalidation: true },
    )

    const targetRefs = await refsOf(targetId)
    expect(targetRefs).toHaveLength(sourceRefs.length)
    expect(targetRefs.some((ref) => sourceRefs.includes(ref))).toBe(false)
  })

  it('a new praca draws a number no other pozycja holds', async () => {
    const live = await serializeKosztorys(sourceId)
    const added = await addItemAction(appendAt(live.sections[0]?.id ?? sectionId))
    if (!added.success) throw new Error(added.error)

    const res = await db.execute(
      sql`SELECT ref FROM kosztorys_items WHERE id = ${added.data.item.id}`,
    )
    const ref = Number(res.rows[0]!.ref)
    const dupes = await db.execute(
      sql`SELECT count(*)::int AS n FROM kosztorys_items WHERE ref = ${ref}`,
    )
    expect(ref).toBeGreaterThan(0)
    expect(Number(dupes.rows[0]!.n)).toBe(1)
  })
})
