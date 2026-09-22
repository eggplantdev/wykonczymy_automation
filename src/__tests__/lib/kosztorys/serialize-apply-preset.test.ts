import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'
import { applyPreset } from '@/lib/kosztorys/apply-preset'
import { seedInvestmentFromPreset } from '@/lib/kosztorys/seed-from-preset'
import { getPreset, insertPreset, upsertPresetByName } from '@/lib/db/presets'
import type { StoredSnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// Presets reuse the snapshot serialize/apply core, so we exercise it against the REAL DB and assert
// PERSISTED state (re-serialize after apply), the same discipline as serialize-restore-roundtrip.
// A preset diverges from a snapshot in two deliberate ways that only a DB round-trip proves: job
// fields are zeroed at serialize time, and apply must NOT write the target's settings.
//
// Cache revalidation touches next/cache outside a request context; stub it so any collection hooks
// fired during apply don't throw in node.
// serializeKosztorys reads through getKosztorysTree, whose DAL guard self-authorizes via requireAuth →
// cookies(), which has no request scope in node. Stub it success like the sibling DB specs.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

// Gated like the sibling DB specs: skips with no DB env, FAILS if env is set but the DB is
// unreachable. Discovered by the `skipIf(!ENV_READY)` marker and run against 5435 by test-integration.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// Global-table presets survive a single test's investment cleanup, so every name carries this prefix
// and afterAll deletes the lot — no cross-run pollution of the shared kosztorys_presets table.
const PRESET_PREFIX = 'preset-spec-'

// Id-free, order-keyed view of a tree WITHOUT settings — a preset's apply intentionally leaves the
// target's settings alone, so settings must be compared separately, never folded into structural
// equality (cf. canonical() in serialize-restore-roundtrip, which keeps settings).
function canonicalTree(snap: StoredSnapshotPayloadT) {
  const sectionById = new Map(snap.sections.map((s) => [s.id, s]))
  const itemById = new Map(snap.items.map((i) => [i.id, i]))
  const stageById = new Map(snap.stages.map((s) => [s.id, s]))

  const sections = [...snap.sections]
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map(({ id: _id, ...rest }) => rest)

  const items = snap.items
    .map(({ id: _id, sectionId, ...rest }) => ({
      sectionOrder: sectionById.get(sectionId)!.displayOrder ?? 0,
      ...rest,
    }))
    .sort(
      (a, b) => a.sectionOrder - b.sectionOrder || (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    )

  const stages = [...snap.stages]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map(({ id: _id, ...r }) => r)

  const progress = snap.progress
    .map((entry) => {
      const item = itemById.get(entry.itemId)!
      return {
        sectionOrder: sectionById.get(item.sectionId)!.displayOrder ?? 0,
        itemOrder: item.displayOrder ?? 0,
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
    const id = await createTestInvestment(payload, name, {
      vatRate: vat,
      wToolsCoeff: wCoeff,
      ownToolsCoeff: oCoeff,
    })
    investmentIds.push(id)
    return id
  }

  // A source tree with the job figures populated (qty, discount, progress) so serialize-as-preset has
  // something real to zero out, plus a komentarz, which it must NOT zero.
  async function buildSourceTree(investmentId: number) {
    await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Sekcja A',
          items: [
            {
              description: 'Malowanie',
              unit: 'm2',
              plannedQty: 10,
              sheetMeasuredQty: 7,
              clientPrice: 100,
              note: 'uwaga do pozycji',
            },
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
          items: [{ description: 'Płytki', unit: 'm2', plannedQty: 20, clientPrice: 250 }],
        },
      ],
      stages: [{ label: 'Etap 1' }, { label: null }],
      progress: [
        { item: 0, stage: 0, qtyDone: 4 },
        { item: 0, stage: 1, qtyDone: 2 },
      ],
    })
  }

  async function applyPresetTx(investmentId: number, preset: StoredSnapshotPayloadT) {
    await withPayloadTransaction(
      payload,
      (req) => applyPreset(payload, req, investmentId, preset),
      { skipRevalidation: true },
    )
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
  })

  afterAll(async () => {
    for (const id of investmentIds) {
      await deleteTestInvestment(payload, id)
    }
    await db.execute(sql`DELETE FROM kosztorys_presets WHERE name LIKE ${PRESET_PREFIX + '%'}`)
  })

  it('apply(serializeAsPreset()) reproduces the structural tree, zeroes the job figures, keeps the komentarz, leaves target settings', async () => {
    const sourceId = await createInvestment(`${PRESET_PREFIX}source-roundtrip`, 0.23, 0.7, 0.5)
    await buildSourceTree(sourceId)

    const preset = await serializeKosztorysAsPreset(sourceId)

    // Target starts empty with DIFFERENT settings — apply must not overwrite them.
    const targetId = await createInvestment(`${PRESET_PREFIX}target-roundtrip`, 0.08, 0.9, 0.6)
    await applyPresetTx(targetId, preset)

    const after = await serializeKosztorys(targetId)

    // Structure (sections/items/stages/progress) is id-free identical to the preset.
    expect(canonicalTree(after)).toEqual(canonicalTree(preset))

    // Job figures are zeroed everywhere — proven on the PERSISTED tree, not just the preset payload.
    for (const item of after.items) {
      expect(item.plannedQty).toBe(0)
      // A reference figure belongs to the job it was imported for, never to the next one.
      expect(item.sheetMeasuredQty).toBeNull()
      expect(item.discountType).toBeNull()
      expect(item.discountValue).toBe(0)
    }
    // The komentarz describes the WORK („cena zawiera transport"), not the job, so it travels —
    // and only on the pozycja that carried one, never smeared across the rest.
    expect(after.items.find((item) => item.description === 'Malowanie')!.note).toBe(
      'uwaga do pozycji',
    )
    expect(after.items.find((item) => item.description === 'Płytki')!.note).toBeNull()
    expect(after.progress).toEqual([])

    // Target's own settings survive the apply untouched (a preset carries no pricing config).
    expect(after.settings).toEqual({
      wToolsCoeff: 0.9,
      ownToolsCoeff: 0.6,
      vatRate: 0.08,
    })
  })

  it('seed from a preset yields no etapy and no progress, whatever the source stages were', async () => {
    const sourceId = await createInvestment(`${PRESET_PREFIX}source-oneetap`, 0.23, 0.7, 0.5)
    await buildSourceTree(sourceId) // source has 2 stages + progress

    const preset = await serializeKosztorysAsPreset(sourceId)
    // A preset carries no etapy — they are per-job execution structure, not reusable scope.
    expect(preset.stages).toEqual([])
    expect(preset.progress).toEqual([])

    const presetId = await insertPreset(db, {
      name: `${PRESET_PREFIX}oneetap`,
      createdBy: null,
      payload: preset,
    })
    const spawnId = await createInvestment(`${PRESET_PREFIX}spawn-oneetap`, 0.23, 0.7, 0.5)
    expect(await seedInvestmentFromPreset(payload, spawnId, presetId!)).toBe('ok')

    const after = await serializeKosztorys(spawnId)
    // No etap is installed: its plane is forced at creation, and the seed has nothing to base one on.
    expect(after.stages).toEqual([])
    expect(after.progress).toEqual([])
  })

  it('seed onto an investment that already has etapy keeps them and adds none', async () => {
    const sourceId = await createInvestment(`${PRESET_PREFIX}source-hasetapy`, 0.23, 0.7, 0.5)
    await buildSourceTree(sourceId)
    const preset = await serializeKosztorysAsPreset(sourceId)
    const presetId = await insertPreset(db, {
      name: `${PRESET_PREFIX}hasetapy`,
      createdBy: null,
      payload: preset,
    })

    // The live shape behind the original bug: an empty tree (no sections) that nonetheless already
    // carries etapy, because „Dodaj etap" works on an empty kosztorys.
    // The seed used to install a starting etap here and collided with UNIQUE(investment_id, ordinal).
    const targetId = await createInvestment(`${PRESET_PREFIX}target-hasetapy`, 0.23, 0.7, 0.5)
    await createKosztorysTree(payload, targetId, {
      sections: [],
      stages: [{ label: null, plane: 'w_tools' }],
    })

    expect(await seedInvestmentFromPreset(payload, targetId, presetId!)).toBe('ok')

    const after = await serializeKosztorys(targetId)
    expect(after.stages).toHaveLength(1)
    expect(after.stages[0].ordinal).toBe(1)
    expect(after.sections.length).toBe(preset.sections.length)
  })

  it('seed rejects a non-empty investment and writes nothing', async () => {
    const targetId = await createInvestment(`${PRESET_PREFIX}source-guard`, 0.23, 0.7, 0.5)
    await buildSourceTree(targetId)
    const preset = await serializeKosztorysAsPreset(targetId)

    // A second investment that ALREADY has a tree — seeding it must be refused.
    const occupiedId = await createInvestment(`${PRESET_PREFIX}target-guard`, 0.23, 0.7, 0.5)
    await createKosztorysTree(payload, occupiedId, { sections: [{ name: 'Istniejąca' }] })
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
    await createKosztorysTree(payload, invB, { sections: [{ name: 'Tylko B' }] })
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
    await createKosztorysTree(payload, invB, { sections: [{ name: 'Nowa treść' }] })
    const presetB = await serializeKosztorysAsPreset(invB)
    await upsertPresetByName(db, { name, createdBy: null, payload: presetB })

    // The spawned tree is frozen — no FK back to the preset, so the overwrite is invisible to it.
    const spawnAfter = await serializeKosztorys(spawnId)
    expect(canonicalTree(spawnAfter)).toEqual(canonicalTree(spawnBefore))
  })
})
