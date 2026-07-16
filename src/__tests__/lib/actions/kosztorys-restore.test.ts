import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'

// restoreSnapshotAction wraps the dangerous wipe-and-reinsert in a transaction and takes a forced
// pre-restore auto snapshot, so we run the REAL action against the REAL DB and assert PERSISTED
// state — a success result would hide a failed write, and the "recoverable mis-restore" guarantee
// is only real if exactly one forced auto row lands.
//
// Same mock surface as the sibling snapshot/stage specs: requireAuth needs a request/cookie we lack
// in node, and cache revalidation touches next/cache outside a request context. `authState` lets the
// gate test flip requireAuth to a rejected role for one call.
const authState = vi.hoisted(() => ({
  userId: 0,
  next: null as null | { success: false; error: string },
}))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => {
    if (authState.next) {
      const rejection = authState.next
      authState.next = null
      return rejection
    }
    return {
      success: true,
      user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
    }
  }),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { restoreSnapshotAction, saveSnapshotAction } =
  await import('@/lib/actions/kosztorys-snapshots')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('restoreSnapshotAction — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const users = await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the snapshot to')
    authState.userId = Number(firstUser.id)
    const investment = await payload.create({
      collection: 'investments',
      data: { name: 'restore-snapshot-test', status: 'active' },
      context: { skipRevalidation: true },
    })
    investmentId = Number(investment.id)
  })

  afterAll(async () => {
    if (investmentId) {
      await payload.delete({
        collection: 'investments',
        id: investmentId,
        context: { skipRevalidation: true },
      })
    }
  })

  const ctx = { context: { skipRevalidation: true } }

  async function sectionNames(): Promise<string[]> {
    const res = await db.execute(sql`
      SELECT name FROM kosztorys_sections WHERE investment_id = ${investmentId} ORDER BY display_order
    `)
    return res.rows.map((r) => String(r.name))
  }

  async function autoCount(): Promise<number> {
    const res = await db.execute(sql`
      SELECT COUNT(*) AS n FROM kosztorys_snapshots WHERE investment_id = ${investmentId} AND kind = 'auto'
    `)
    return Number(res.rows[0].n)
  }

  it('reverts a mutated tree and creates exactly one forced auto snapshot', async () => {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: 'Original',
        displayOrder: 0,
        defaultCostVariant: 'w_tools',
      },
      ...ctx,
    })
    await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: section.id,
        displayOrder: 0,
        plannedQty: 0,
        discountValue: 0,
        clientPrice: 0,
        hiddenInExport: false,
      },
      ...ctx,
    })

    const saved = await saveSnapshotAction(investmentId, 'przed zmianą')
    expect(saved.success).toBe(true)
    const snapRow = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId} AND kind = 'manual' ORDER BY id DESC LIMIT 1
    `)
    const snapshotId = Number(snapRow.rows[0].id)

    // Mutate: rename the section and add a second one.
    await payload.update({
      collection: 'kosztorys-sections',
      id: section.id,
      data: { name: 'Zmienione' },
      ...ctx,
    })
    await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: 'Nowa',
        displayOrder: 1,
        defaultCostVariant: 'w_tools',
      },
      ...ctx,
    })
    expect(await sectionNames()).toEqual(['Zmienione', 'Nowa'])

    const autoBefore = await autoCount()
    const res = await restoreSnapshotAction(snapshotId, investmentId)
    expect(res.success).toBe(true)

    // Tree is back to the single saved section (new ids, same content/order).
    expect(await sectionNames()).toEqual(['Original'])
    const items = await db.execute(sql`
      SELECT COUNT(*) AS n FROM kosztorys_items WHERE investment_id = ${investmentId}
    `)
    expect(Number(items.rows[0].n)).toBe(1)
    // Exactly one forced pre-restore auto snapshot landed.
    expect(await autoCount()).toBe(autoBefore + 1)
  })

  it('refuses to restore a snapshot belonging to another investment and writes nothing', async () => {
    // A manual snapshot that belongs to investment A (this suite's investmentId).
    expect((await saveSnapshotAction(investmentId, 'wersja A')).success).toBe(true)
    const snapRow = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId} AND kind = 'manual' ORDER BY id DESC LIMIT 1
    `)
    const snapshotIdA = Number(snapRow.rows[0].id)

    // A separate investment B — the editor's current context.
    const investmentB = await payload.create({
      collection: 'investments',
      data: { name: 'restore-scope-other', status: 'active' },
      context: { skipRevalidation: true },
    })
    const investmentIdB = Number(investmentB.id)
    try {
      const namesABefore = await sectionNames()
      const autoABefore = await autoCount()

      // Loading A's snapshot into B's context must be refused — touching NEITHER investment.
      const res = await restoreSnapshotAction(snapshotIdA, investmentIdB)
      expect(res.success).toBe(false)

      // Investment A is not wiped/reinserted and takes no forced pre-restore snapshot.
      expect(await sectionNames()).toEqual(namesABefore)
      expect(await autoCount()).toBe(autoABefore)
    } finally {
      await payload.delete({
        collection: 'investments',
        id: investmentIdB,
        context: { skipRevalidation: true },
      })
    }
  })

  it('is gated — a non-MANAGEMENT role gets Brak uprawnień and writes nothing', async () => {
    const namesBefore = await sectionNames()
    const autoBefore = await autoCount()
    authState.next = { success: false, error: 'Brak uprawnień' }

    const res = await restoreSnapshotAction(1, investmentId)

    expect(res.success).toBe(false)
    expect(res.success === false && res.error).toBe('Brak uprawnień')
    expect(await sectionNames()).toEqual(namesBefore)
    expect(await autoCount()).toBe(autoBefore)
  })
})
