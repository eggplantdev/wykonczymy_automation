import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'
import { applyPreset } from '@/lib/kosztorys/apply-preset'
import { seedInvestmentFromPreset } from '@/lib/kosztorys/seed-from-preset'
import type { StoredSnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { createTestTemplate } from '@/__tests__/helpers/template'

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

  // `ref` is an identity like `id`: a szablon mints new ones (item-ref.db.test.ts asserts that).
  const items = snap.items
    .map(({ id: _id, ref: _ref, sectionId, ...rest }) => ({
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
  // something real to zero out, plus a komentarz, which stays behind with them.
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
              catalogueItemId: null,
              aiPlannedQty: 8,
              changeReason: 'AI zaniżyło metraż',
              reviewStatus: 'edited',
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

  // A szablon whose LIVE tree carries przedmiar, rabat, etapy and progress — everything a seed from it
  // must strip, since the szablon's own editor lets anyone type them in.
  async function createTemplateWithJobFigures(name: string) {
    const id = await createTestTemplate(payload, `${PRESET_PREFIX}${name}`)
    investmentIds.push(id)
    await buildSourceTree(id)
    return id
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
  })

  afterAll(async () => {
    for (const id of investmentIds) {
      await deleteTestInvestment(payload, id)
    }
  })

  it('apply(serializeAsPreset()) reproduces the structural tree, zeroes the job figures and the komentarz, leaves target settings', async () => {
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
      // The AI review judges one job's draft, so a szablon must not hand it to the next one.
      expect(item.aiPlannedQty).toBeNull()
      expect(item.changeReason).toBeNull()
      expect(item.reviewStatus).toBeNull()
    }
    // A remark about the WORK lives on its katalog entry; the pozycja's own one is about this job.
    expect(after.items.find((item) => item.description === 'Malowanie')!.note).toBeNull()
    expect(after.progress).toEqual([])

    // Target's own settings survive the apply untouched (a preset carries no pricing config).
    expect(after.settings).toEqual({
      wToolsCoeff: 0.9,
      ownToolsCoeff: 0.6,
      vatRate: 0.08,
    })
  })

  it('seed from a szablon yields no etapy, no progress, no przedmiar and no rabat', async () => {
    const presetId = await createTemplateWithJobFigures('oneetap')
    // A preset carries no etapy — they are per-job execution structure, not reusable scope.
    const preset = await serializeKosztorysAsPreset(presetId)
    expect(preset.stages).toEqual([])
    expect(preset.progress).toEqual([])

    const spawnId = await createInvestment(`${PRESET_PREFIX}spawn-oneetap`, 0.23, 0.7, 0.5)
    expect(await seedInvestmentFromPreset(payload, spawnId, presetId)).toBe('ok')

    const after = await serializeKosztorys(spawnId)
    // No etap is installed: its plane is forced at creation, and the seed has nothing to base one on.
    expect(after.stages).toEqual([])
    expect(after.progress).toEqual([])
    expect(after.items).toHaveLength(3)
    for (const item of after.items) {
      expect(item.plannedQty).toBe(0)
      expect(item.discountType).toBeNull()
      expect(item.discountValue).toBe(0)
    }
  })

  it('seed onto an investment that already has etapy keeps them and adds none', async () => {
    const presetId = await createTemplateWithJobFigures('hasetapy')

    // The live shape behind the original bug: an empty tree (no sections) that nonetheless already
    // carries etapy, because „Dodaj etap" works on an empty kosztorys.
    // The seed used to install a starting etap here and collided with UNIQUE(investment_id, ordinal).
    const targetId = await createInvestment(`${PRESET_PREFIX}target-hasetapy`, 0.23, 0.7, 0.5)
    await createKosztorysTree(payload, targetId, {
      sections: [],
      stages: [{ label: null, plane: 'w_tools' }],
    })

    expect(await seedInvestmentFromPreset(payload, targetId, presetId)).toBe('ok')

    const after = await serializeKosztorys(targetId)
    expect(after.stages).toHaveLength(1)
    expect(after.stages[0].ordinal).toBe(1)
    expect(after.sections).toHaveLength(2)
  })

  it('seed rejects a non-empty investment and writes nothing', async () => {
    const presetId = await createTemplateWithJobFigures('guard')

    // A second investment that ALREADY has a tree — seeding it must be refused.
    const occupiedId = await createInvestment(`${PRESET_PREFIX}target-guard`, 0.23, 0.7, 0.5)
    await createKosztorysTree(payload, occupiedId, { sections: [{ name: 'Istniejąca' }] })

    const before = await serializeKosztorys(occupiedId)
    const result = await seedInvestmentFromPreset(payload, occupiedId, presetId)
    const after = await serializeKosztorys(occupiedId)

    expect(result).toBe('not-empty')
    // Nothing written — the pre-existing tree is byte-for-byte unchanged.
    expect(canonicalTree(after)).toEqual(canonicalTree(before))
  })

  // Only a szablon is a source: seeding from an ordinary investment's id would copy a client's
  // rozpiska into someone else's offer.
  it('seed refuses a source that is not a szablon and writes nothing', async () => {
    const sourceId = await createInvestment(`${PRESET_PREFIX}source-ordinary`, 0.23, 0.7, 0.5)
    await buildSourceTree(sourceId)
    const targetId = await createInvestment(`${PRESET_PREFIX}target-ordinary`, 0.23, 0.7, 0.5)

    expect(await seedInvestmentFromPreset(payload, targetId, sourceId)).toBe('not-found')
    expect((await serializeKosztorys(targetId)).sections).toEqual([])
  })

  it('editing a szablon never propagates to a tree already spawned from it', async () => {
    const presetId = await createTemplateWithJobFigures('frozen')

    const spawnId = await createInvestment(`${PRESET_PREFIX}spawn-frozen`, 0.23, 0.7, 0.5)
    expect(await seedInvestmentFromPreset(payload, spawnId, presetId)).toBe('ok')
    const spawnBefore = await serializeKosztorys(spawnId)

    // The szablon grows a section after the spawn.
    await createKosztorysTree(payload, presetId, { sections: [{ name: 'Nowa treść' }] })

    // The spawned tree is frozen — no FK back to the szablon, so the edit is invisible to it.
    const spawnAfter = await serializeKosztorys(spawnId)
    expect(canonicalTree(spawnAfter)).toEqual(canonicalTree(spawnBefore))
  })
})
