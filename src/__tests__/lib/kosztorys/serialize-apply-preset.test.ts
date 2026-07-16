import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'
import { applyPreset } from '@/lib/kosztorys/apply-preset'
import { seedInvestmentFromPreset } from '@/lib/kosztorys/seed-from-preset'
import { getPreset, insertPreset, upsertPresetByName } from '@/lib/db/presets'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

// Presets reuse the snapshot serialize/apply core, so we exercise it against the REAL DB and assert
// PERSISTED state (re-serialize after apply), the same discipline as serialize-restore-roundtrip.
// A preset diverges from a snapshot in two deliberate ways that only a DB round-trip proves: job
// fields are zeroed at serialize time, and apply must NOT write the target's settings.
//
// Cache revalidation touches next/cache outside a request context; stub it so any collection hooks
// fired during apply don't throw in node.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))

// Gated like the sibling DB specs: skips with no DB env, FAILS if env is set but the DB is
// unreachable. Discovered by the `skipIf(!ENV_READY)` marker and run against 5435 by test-integration.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// Global-table presets survive a single test's investment cleanup, so every name carries this prefix
// and afterAll deletes the lot — no cross-run pollution of the shared kosztorys_presets table.
const PRESET_PREFIX = 'preset-spec-'

// Id-free, order-keyed view of a tree WITHOUT settings — a preset's apply intentionally leaves the
// target's settings alone, so settings must be compared separately, never folded into structural
// equality (cf. canonical() in serialize-restore-roundtrip, which keeps settings).
function canonicalTree(snap: SnapshotPayloadT) {
  const sectionById = new Map(snap.sections.map((s) => [s.id, s]))
  const itemById = new Map(snap.items.map((i) => [i.id, i]))
  const stageById = new Map(snap.stages.map((s) => [s.id, s]))

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

  return { sections, items, stages, progress }
}

describe.skipIf(!ENV_READY)('serialize → apply preset (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const investmentIds: number[] = []

  // A throwaway investment with the given settings; tracked for cascade cleanup in afterAll.
  async function createInvestment(name: string, vat: number, wCoeff: number, oCoeff: number) {
    const inv = await payload.create({
      collection: 'investments',
      data: { name, status: 'active', wToolsCoeff: wCoeff, ownToolsCoeff: oCoeff },
      context: { skipRevalidation: true },
    })
    const id = Number(inv.id)
    await db.execute(sql`UPDATE investments SET vat_rate = ${vat} WHERE id = ${id}`)
    investmentIds.push(id)
    return id
  }

  // A source tree with JOB fields populated (qty, discount, note, progress) so serialize-as-preset
  // has something real to zero out.
  async function buildSourceTree(investmentId: number) {
    const sectionA = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: 'Sekcja A',
        displayOrder: 0,
        defaultCostVariant: 'w_tools',
        wToolsCoeff: 0.8,
        ownToolsCoeff: null,
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
        wToolsCoeff: null,
        ownToolsCoeff: null,
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
        note: 'uwaga do pozycji',
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
        hiddenInExport: true,
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
        hiddenInExport: false,
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

    await db.execute(sql`
      INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at) VALUES
        (${item1.id}, ${stage1.id}, 4, now(), now()),
        (${item1.id}, ${stage2.id}, 2, now(), now())
    `)
  }

  async function applyPresetTx(investmentId: number, preset: SnapshotPayloadT) {
    const transactionId = await payload.db.beginTransaction()
    if (!transactionId) throw new Error('Failed to start transaction')
    try {
      await applyPreset(
        payload,
        { transactionID: transactionId, context: { skipRevalidation: true } } as never,
        investmentId,
        preset,
      )
      await payload.db.commitTransaction(transactionId)
    } catch (err) {
      await payload.db.rollbackTransaction(transactionId)
      throw err
    }
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
  })

  afterAll(async () => {
    for (const id of investmentIds) {
      await payload.delete({ collection: 'investments', id, context: { skipRevalidation: true } })
    }
    await db.execute(sql`DELETE FROM kosztorys_presets WHERE name LIKE ${PRESET_PREFIX + '%'}`)
  })

  it('apply(serializeAsPreset()) reproduces the structural tree, zeroes job fields, leaves target settings', async () => {
    const sourceId = await createInvestment(`${PRESET_PREFIX}source-roundtrip`, 0.23, 0.7, 0.5)
    await buildSourceTree(sourceId)

    const preset = await serializeKosztorysAsPreset(sourceId)

    // Target starts empty with DIFFERENT settings — apply must not overwrite them.
    const targetId = await createInvestment(`${PRESET_PREFIX}target-roundtrip`, 0.08, 0.9, 0.6)
    await applyPresetTx(targetId, preset)

    const after = await serializeKosztorys(targetId)

    // Structure (sections/items/stages/progress) is id-free identical to the preset.
    expect(canonicalTree(after)).toEqual(canonicalTree(preset))

    // Job fields are zeroed everywhere — proven on the PERSISTED tree, not just the preset payload.
    for (const item of after.items) {
      expect(item.plannedQty).toBe(0)
      expect(item.discountType).toBeNull()
      expect(item.discountValue).toBe(0)
      expect(item.hiddenInExport).toBe(false)
      expect(item.note).toBeNull()
    }
    expect(after.progress).toEqual([])

    // Target's own settings survive the apply untouched (a preset carries no pricing config).
    expect(after.settings).toEqual({ wToolsCoeff: 0.9, ownToolsCoeff: 0.6, vatRate: 0.08 })
  })

  it('seed rejects a non-empty investment and writes nothing', async () => {
    const targetId = await createInvestment(`${PRESET_PREFIX}source-guard`, 0.23, 0.7, 0.5)
    await buildSourceTree(targetId)
    const preset = await serializeKosztorysAsPreset(targetId)

    // A second investment that ALREADY has a tree — seeding it must be refused.
    const occupiedId = await createInvestment(`${PRESET_PREFIX}target-guard`, 0.23, 0.7, 0.5)
    await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: occupiedId,
        name: 'Istniejąca',
        displayOrder: 0,
        defaultCostVariant: 'w_tools',
        wToolsCoeff: null,
        ownToolsCoeff: null,
      },
      context: { skipRevalidation: true },
    })
    const presetId = await insertPreset(db, {
      name: `${PRESET_PREFIX}guard`,
      createdBy: null,
      payload: preset,
    })

    const before = await serializeKosztorys(occupiedId)
    const result = await seedInvestmentFromPreset(payload, occupiedId, presetId!)
    const after = await serializeKosztorys(occupiedId)

    expect(result).toBe('not-empty')
    // Nothing written — the pre-existing tree is byte-for-byte unchanged.
    expect(canonicalTree(after)).toEqual(canonicalTree(before))
  })

  it('insert rejects a duplicate name; overwrite replaces the payload in place', async () => {
    const invA = await createInvestment(`${PRESET_PREFIX}source-unique-a`, 0.23, 0.7, 0.5)
    await buildSourceTree(invA)
    const presetA = await serializeKosztorysAsPreset(invA)

    const invB = await createInvestment(`${PRESET_PREFIX}source-unique-b`, 0.23, 0.7, 0.5)
    await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: invB,
        name: 'Tylko B',
        displayOrder: 0,
        defaultCostVariant: 'w_tools',
        wToolsCoeff: null,
        ownToolsCoeff: null,
      },
      context: { skipRevalidation: true },
    })
    const presetB = await serializeKosztorysAsPreset(invB)

    const name = `${PRESET_PREFIX}unique`
    const firstId = await insertPreset(db, { name, createdBy: null, payload: presetA })
    expect(firstId).not.toBeNull()

    // Same name again → ON CONFLICT DO NOTHING → null (no second row, no throw).
    const dupId = await insertPreset(db, { name, createdBy: null, payload: presetB })
    expect(dupId).toBeNull()

    // Overwrite keeps the same row id but swaps the payload.
    const overwriteId = await upsertPresetByName(db, { name, createdBy: null, payload: presetB })
    expect(overwriteId).toBe(firstId)

    const stored = await getPreset(db, firstId!)
    expect(canonicalTree(stored!.payload)).toEqual(canonicalTree(presetB))
  })

  it('overwriting a preset never propagates to a tree already spawned from it', async () => {
    const invA = await createInvestment(`${PRESET_PREFIX}source-frozen-a`, 0.23, 0.7, 0.5)
    await buildSourceTree(invA)
    const presetA = await serializeKosztorysAsPreset(invA)

    const name = `${PRESET_PREFIX}frozen`
    const presetId = await insertPreset(db, { name, createdBy: null, payload: presetA })

    // Spawn an investment's tree from the preset.
    const spawnId = await createInvestment(`${PRESET_PREFIX}spawn-frozen`, 0.23, 0.7, 0.5)
    expect(await seedInvestmentFromPreset(payload, spawnId, presetId!)).toBe('ok')
    const spawnBefore = await serializeKosztorys(spawnId)

    // Overwrite the preset with a DIFFERENT tree.
    const invB = await createInvestment(`${PRESET_PREFIX}source-frozen-b`, 0.23, 0.7, 0.5)
    await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: invB,
        name: 'Nowa treść',
        displayOrder: 0,
        defaultCostVariant: 'own_tools',
        wToolsCoeff: null,
        ownToolsCoeff: null,
      },
      context: { skipRevalidation: true },
    })
    const presetB = await serializeKosztorysAsPreset(invB)
    await upsertPresetByName(db, { name, createdBy: null, payload: presetB })

    // The spawned tree is frozen — no FK back to the preset, so the overwrite is invisible to it.
    const spawnAfter = await serializeKosztorys(spawnId)
    expect(canonicalTree(spawnAfter)).toEqual(canonicalTree(spawnBefore))
  })
})
