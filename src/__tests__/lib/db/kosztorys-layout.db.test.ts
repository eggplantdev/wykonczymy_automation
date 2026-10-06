import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { LAYOUT_STALE } from '@/lib/db/kosztorys-layout'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// The real action against the real DB: the permutation guard and "a version only for a write that
// landed" are only true of persisted rows, and a success result would hide a failed UPDATE.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { writeKosztorysLayoutAction } = await import('@/lib/actions/kosztorys')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('writeKosztorysLayoutAction — persisted layout (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number
  let sectionIds: number[]
  let itemIds: number[]
  let foreignItemId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    authState.userId = Number(users.docs[0]?.id)
    investmentId = await createTestInvestment(payload, `layout-test-${Date.now()}`)
    otherInvestmentId = await createTestInvestment(payload, `layout-test-other-${Date.now()}`)
    ;({ sectionIds, itemIds } = await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'Salon', items: [{ description: 'a' }, { description: 'b' }] },
        { name: 'Kuchnia', items: [{ description: 'c' }] },
      ],
    }))
    const foreign = await createKosztorysTree(payload, otherInvestmentId, {
      sections: [{ name: 'Obca', items: [{ description: 'x' }] }],
    })
    foreignItemId = foreign.itemIds[0] ?? 0
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    if (otherInvestmentId) await deleteTestInvestment(payload, otherInvestmentId)
  })

  const persisted = async () => {
    const sections = await db.execute(sql`
      SELECT id FROM kosztorys_sections WHERE investment_id = ${investmentId} ORDER BY display_order
    `)
    const items = await db.execute(sql`
      SELECT id, section_id, display_order FROM kosztorys_items
      WHERE investment_id = ${investmentId} ORDER BY section_id, display_order
    `)
    return {
      sections: sections.rows.map((row) => Number(row.id)),
      items: items.rows.map((row) => [
        Number(row.id),
        Number(row.section_id),
        Number(row.display_order),
      ]),
    }
  }

  const autoCount = async () =>
    Number(
      (
        await db.execute(sql`
          SELECT COUNT(*) AS n FROM kosztorys_snapshots
          WHERE investment_id = ${investmentId} AND kind = 'auto'
        `)
      ).rows[0]?.n,
    )

  const revision = async () =>
    String(
      (await db.execute(sql`SELECT updated_at FROM investments WHERE id = ${investmentId}`)).rows[0]
        ?.updated_at,
    )

  it('moves a row across sections, reorders sections, and takes exactly one version', async () => {
    const [salon, kuchnia] = sectionIds as [number, number]
    const [a, b, c] = itemIds as [number, number, number]
    const snapshotsBefore = await autoCount()
    const revisionBefore = await revision()

    const res = await writeKosztorysLayoutAction(investmentId, [
      { sectionId: kuchnia, itemIds: [b, c] },
      { sectionId: salon, itemIds: [a] },
    ])

    expect(res).toEqual({ success: true })
    const after = await persisted()
    expect(after.sections).toEqual([kuchnia, salon])
    expect(after.items).toEqual(
      expect.arrayContaining([
        [b, kuchnia, 0],
        [c, kuchnia, 1],
        [a, salon, 0],
      ]),
    )
    expect(await autoCount()).toBe(snapshotsBefore + 1)
    expect(await revision()).not.toBe(revisionBefore)
  })

  it.each([
    ['missing a row', (ids: number[]) => ids.slice(1)],
    ['carrying an unknown id', (ids: number[]) => [...ids, 2_000_000_000]],
    ['carrying another investment’s row', (ids: number[]) => [...ids, foreignItemId]],
  ])('refuses a layout %s, writes nothing and takes no version', async (_, mutate) => {
    const before = await persisted()
    const snapshotsBefore = await autoCount()
    const [first, second] = sectionIds as [number, number]
    const allItems = before.items.map(([id]) => id as number)

    const res = await writeKosztorysLayoutAction(investmentId, [
      { sectionId: second, itemIds: mutate(allItems) },
      { sectionId: first, itemIds: [] },
    ])

    expect(res).toEqual({ success: false, error: LAYOUT_STALE })
    expect(await persisted()).toEqual(before)
    expect(await autoCount()).toBe(snapshotsBefore)
  })
})
