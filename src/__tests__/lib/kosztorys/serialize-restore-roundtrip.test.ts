import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

// The serialize→restore pair is the dangerous wipe-and-reinsert core, so we exercise it against the
// REAL DB and assert PERSISTED state: restore is only correct if a re-serialize of the live tree
// after restore is content-identical to the snapshot (new ids, same fields + order).
//
// Cache revalidation touches next/cache outside a request context; stub it so the collection
// afterChange/afterDelete hooks fired during restore don't throw in node.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))
// serializeKosztorys reads through getKosztorysTree, whose DAL guard self-authorizes via requireAuth →
// cookies(), which has no request scope in node. Stub it success like the sibling DB specs.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

// Gated like the sibling DB specs: skips with no DB env (portable), FAILS if env is set but the DB
// is unreachable. Run against the local DB with `--env-file=.env`.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// Canonical, id-free view of a snapshot: children keyed by their parent's stable order (section
// displayOrder, item displayOrder, stage ordinal) rather than by the ids restore remints. Two trees
// with identical content but different ids produce equal canonical forms.
function canonical(snap: SnapshotPayloadT) {
  const sectionById = new Map(snap.sections.map((section) => [section.id, section]))
  const itemById = new Map(snap.items.map((item) => [item.id, item]))
  const stageById = new Map(snap.stages.map((stage) => [stage.id, stage]))

  const sections = [...snap.sections]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(({ id: _id, ...rest }) => rest)

  const items = snap.items
    .map(({ id: _id, sectionId, ...rest }) => ({
      sectionOrder: sectionById.get(sectionId)!.displayOrder,
      ...rest,
    }))
    .sort((a, b) => a.sectionOrder - b.sectionOrder || a.displayOrder - b.displayOrder)

  const stages = [...snap.stages]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map(({ id: _id, ...r }) => r)

  const progress = snap.progress
    .map((entry) => {
      const item = itemById.get(entry.itemId)!
      return {
        sectionOrder: sectionById.get(item.sectionId)!.displayOrder,
        itemOrder: item.displayOrder,
        stageOrdinal: stageById.get(entry.stageId)!.ordinal,
        qtyDone: entry.qtyDone,
      }
    })
    .sort(
      (a, b) =>
        a.sectionOrder - b.sectionOrder ||
        a.itemOrder - b.itemOrder ||
        a.stageOrdinal - b.stageOrdinal,
    )

  return { sections, items, stages, progress, settings: snap.settings }
}

describe.skipIf(!ENV_READY)('serialize → restore round-trip (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    // A throwaway investment so the whole-tree wipe never touches seeded data; deleted (cascade) after.
    const investment = await payload.create({
      collection: 'investments',
      data: {
        name: 'snapshot-roundtrip-test',
        status: 'active',
        wToolsCoeff: 0.7,
        ownToolsCoeff: 0.5,
      },
      context: { skipRevalidation: true },
    })
    investmentId = Number(investment.id)
    await db.execute(sql`UPDATE investments SET vat_rate = 0.23 WHERE id = ${investmentId}`)

    // Build a small tree: 2 sections, items, 2 stages, sparse progress.
    const sectionA = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: 'Sekcja A',
        displayOrder: 0,
        defaultCostVariant: 'w_tools',
      },
      context: { skipRevalidation: true },
    })
    const sectionB = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: 'Sekcja B',
        displayOrder: 1,
        defaultCostVariant: 'own_tools',
      },
      context: { skipRevalidation: true },
    })

    const item1 = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: sectionA.id,
        displayOrder: 0,
        description: 'Malowanie',
        unit: 'm2',
        plannedQty: 10,
        clientPrice: 100,
        discountValue: 0,
        hiddenInExport: false,
      },
      context: { skipRevalidation: true },
    })
    await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: sectionA.id,
        displayOrder: 1,
        description: 'Gruntowanie',
        unit: 'm2',
        plannedQty: 5,
        clientPrice: 40,
        discountType: 'percent',
        discountValue: 10,
        hiddenInExport: false,
      },
      context: { skipRevalidation: true },
    })
    await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: sectionB.id,
        displayOrder: 0,
        description: 'Płytki',
        unit: 'm2',
        plannedQty: 20,
        clientPrice: 250,
        discountValue: 0,
        hiddenInExport: true,
      },
      context: { skipRevalidation: true },
    })

    const stage1 = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: investmentId, ordinal: 1, label: 'Etap 1' },
      context: { skipRevalidation: true },
    })
    const stage2 = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: investmentId, ordinal: 2, label: null },
      context: { skipRevalidation: true },
    })

    // Sparse progress: item1 has both stages, other items none.
    await db.execute(sql`
      INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at) VALUES
        (${item1.id}, ${stage1.id}, 4, now(), now()),
        (${item1.id}, ${stage2.id}, 2, now(), now())
    `)
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

  it('restore(serialize()) is a content + order identity with fresh ids', async () => {
    const before = await serializeKosztorys(investmentId)

    // Mutate the live tree so restore has real work to undo: change a price, delete a section,
    // change the settings.
    await payload.update({
      collection: 'kosztorys-items',
      id: before.items[0].id,
      data: { clientPrice: 9999 },
      context: { skipRevalidation: true },
    })
    await payload.delete({
      collection: 'kosztorys-sections',
      id: before.sections[1].id,
      context: { skipRevalidation: true },
    })
    await db.execute(sql`UPDATE investments SET vat_rate = 0.08 WHERE id = ${investmentId}`)

    const transactionId = await payload.db.beginTransaction()
    if (!transactionId) throw new Error('Failed to start transaction')
    try {
      await restoreKosztorys(
        payload,
        { transactionID: transactionId, context: { skipRevalidation: true } } as never,
        investmentId,
        before,
      )
      await payload.db.commitTransaction(transactionId)
    } catch (err) {
      await payload.db.rollbackTransaction(transactionId)
      throw err
    }

    const after = await serializeKosztorys(investmentId)

    // New ids everywhere — proves a real wipe-and-reinsert, not an in-place no-op.
    expect(after.sections.map((s) => s.id).sort()).not.toEqual(
      before.sections.map((s) => s.id).sort(),
    )
    // ...but content + order is identical.
    expect(canonical(after)).toEqual(canonical(before))
  })
})
