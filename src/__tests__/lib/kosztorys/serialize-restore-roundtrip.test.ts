import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// The serialize→restore pair is the dangerous wipe-and-reinsert core, so we exercise it against the
// REAL DB and assert PERSISTED state: restore is only correct if a re-serialize of the live tree
// after restore is content-identical to the snapshot (new ids, same fields + order).
//
// Cache revalidation touches next/cache outside a request context; stub it so the collection
// afterChange/afterDelete hooks fired during restore don't throw in node.
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
    investmentId = await createTestInvestment(payload, 'snapshot-roundtrip-test', {
      vatRate: 0.23,
      wToolsCoeff: 0.7,
      ownToolsCoeff: 0.5,
    })

    // A real user id, not a hardcoded 1 — worker_id FKs users.id and a fresh prod-dump test DB has
    // no guaranteed user 1.
    const users = await payload.find({ collection: 'users', limit: 1, depth: 0, sort: 'id' })
    const workerId = Number(users.docs[0]!.id)

    // Sekcja C exists purely for COLUMN COVERAGE. Restore hand-writes the INSERT column list and
    // zips values into it positionally, so a column the fixture never sets is a column whose mapping
    // no test can catch being wrong. Its two items are the extremes — every nullable field null, and
    // every nullable field set — plus the section colour, the stage plane, and a note carrying
    // unicode + a newline (a naive value-quoting bug shows up there first).
    await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          items: [
            { description: 'Malowanie', unit: 'm2', plannedQty: 10, clientPrice: 100 },
            {
              description: 'Gruntowanie',
              unit: 'm2',
              plannedQty: 5,
              clientPrice: 40,
              discountType: 'percent',
              discountValue: 10,
            },
          ],
        },
        {
          name: 'Sekcja B',
          items: [
            {
              description: 'Płytki',
              unit: 'm2',
              plannedQty: 20,
              clientPrice: 250,
            },
          ],
        },
        {
          name: 'Sekcja C — pokrycie kolumn',
          color: 'blue-soft',
          items: [
            // Every nullable field null / every numeric field zero — the low extreme. Spelled out
            // rather than left to the builder's defaults: this row's job is to state the extreme.
            {
              description: null,
              unit: null,
              plannedQty: 0,
              sheetMeasuredQty: null,
              discountType: null,
              discountValue: 0,
              clientPrice: 0,
              wToolsOverrideValue: null,
              ownToolsOverrideValue: null,
              note: null,
            },
            {
              description: 'Ścianka działowa — GK 12,5 „podwójna"\ndruga linia opisu',
              unit: 'mb',
              plannedQty: 12.5,
              // Fractional and different from the przedmiar: a field dropped from the VALUES tuple or
              // zipped one column over shows up here rather than passing as a coincidence.
              sheetMeasuredQty: 11.25,
              discountType: 'amount',
              discountValue: 33.33,
              clientPrice: 149.99,
              // Kwota na jednej płaszczyźnie, mnożnik na drugiej: para kolumn przeżywa roundtrip
              // tylko wtedy, gdy obie połowy są gdzieś niepuste — inaczej wypadnięcie `*OverrideCoeff`
              // z serializacji przechodzi jako „wszędzie null".
              wToolsOverrideCoeff: 0.7,
              wToolsOverrideValue: null,
              ownToolsOverrideValue: 88.5,
              note: 'Uwaga: różnica ±5 cm\nDrugi wiersz — ćwierć „cudzysłów"',
            },
            // The mirrored override combo. Per plane both legal states — „kwota stała" and „auto" —
            // must appear somewhere, or a swapped pair of override columns survives the roundtrip
            // unnoticed.
            {
              description: 'Odwrócone nadpisania',
              unit: 'szt',
              plannedQty: 3,
              discountType: 'percent',
              discountValue: 5,
              clientPrice: 75,
              wToolsOverrideValue: 210.4,
              ownToolsOverrideValue: null,
              ownToolsOverrideCoeff: 0.42,
            },
          ],
        },
      ],
      stages: [
        { label: 'Etap 1', plane: 'w_tools', worker: workerId },
        // The all-nullable extreme on a stages row: the omitted plane and worker default null too.
        { label: null },
        { label: 'Etap 3', plane: 'own_tools' },
      ],
      // Sparse: the first item has both stages, every other item none.
      progress: [
        { item: 0, stage: 0, qtyDone: 4 },
        { item: 0, stage: 1, qtyDone: 2 },
      ],
    })
  })

  afterAll(async () => {
    if (investmentId) {
      await deleteTestInvestment(payload, investmentId)
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

    await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, investmentId, before),
      { skipRevalidation: true },
    )

    const after = await serializeKosztorys(investmentId)

    // New ids everywhere — proves a real wipe-and-reinsert, not an in-place no-op.
    const ids = (snap: SnapshotPayloadT) => snap.sections.map((s) => s.id).sort((a, b) => a - b)
    expect(ids(after)).not.toEqual(ids(before))
    expect(canonical(after)).toEqual(canonical(before))
  })

  // Snapshots taken before EX-613 carry stages with no `workerId` key at all. Restoring one must
  // land `null` rather than throw or write garbage — the reason the column needed no schema-version
  // bump. Runs last: it leaves the tree without assignments, and the identity test above is the one
  // that depends on the fixture's.
  it('restores a pre-EX-613 snapshot (stages with no workerId) as unassigned', async () => {
    const current = await serializeKosztorys(investmentId)
    const legacy = {
      ...current,
      stages: current.stages.map(({ workerId: _dropped, ...rest }) => rest),
    } as SnapshotPayloadT

    await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, investmentId, legacy),
      { skipRevalidation: true },
    )

    const after = await serializeKosztorys(investmentId)
    expect(after.stages.map((stage) => stage.workerId)).toEqual(after.stages.map(() => null))
  })
})
