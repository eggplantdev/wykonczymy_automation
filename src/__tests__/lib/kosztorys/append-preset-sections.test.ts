import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { serializeKosztorysAsPreset } from '@/lib/kosztorys/serialize-preset'
import { insertPreset } from '@/lib/db/presets'
import { appendPresetSectionsAction } from '@/lib/actions/kosztorys-presets'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'

// Same discipline as serialize-apply-preset: exercise against the REAL DB and assert PERSISTED state
// by re-reading. next/cache is stubbed so the action's revalidateCollections (updateTag) doesn't throw
// outside a request context; require-auth is stubbed so the REAL action runs — its selection→payload
// resolution and rollback-on-error are exactly what specs (d)/(e) turn on and can't be proven from the
// bare helper (which never sees an unknown section id).
// unstable_cache is a passthrough here: the action's graph pulls in getPresetSections, and an
// uncached read is exactly what the test wants (it re-reads the DB directly for its assertions).
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PRESET_PREFIX = 'append-spec-'

describe.skipIf(!ENV_READY)('appendPresetSections (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const investmentIds: number[] = []

  async function createInvestment(name: string) {
    const inv = await payload.create({
      collection: 'investments',
      data: { name, status: 'active', wToolsCoeff: 0.7, ownToolsCoeff: 0.5 },
      context: { skipRevalidation: true },
    })
    const id = Number(inv.id)
    investmentIds.push(id)
    return id
  }

  // Add one section (with a coefficient) + one item (with job fields populated and a coefficient
  // override) to `investmentId`; returns the created section id. Job fields are populated so the
  // zeroing at serialize time is observable on the appended copy.
  async function addSection(investmentId: number, name: string, displayOrder: number) {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name,
        displayOrder,
        defaultCostVariant: 'w_tools',
        wToolsCoeff: 0.8,
        ownToolsCoeff: null,
      },
      context: { skipRevalidation: true },
    })
    await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: section.id,
        displayOrder: 0,
        description: `Praca w ${name}`,
        unit: 'm2',
        plannedQty: 12,
        clientPrice: 150,
        discountType: 'percent',
        discountValue: 10,
        wToolsOverrideType: 'coeff',
        wToolsOverrideValue: 0.65,
        hiddenInExport: true,
        note: 'uwaga',
      },
      context: { skipRevalidation: true },
    })
    return Number(section.id)
  }

  // Build a source investment with one named section, serialize it as a preset, store it, and return
  // the preset id + the in-payload section id the picker/action addresses it by.
  async function buildPreset(nameSuffix: string, sectionName: string) {
    const sourceId = await createInvestment(`${PRESET_PREFIX}src-${nameSuffix}`)
    await addSection(sourceId, sectionName, 0)
    const payloadSnap = await serializeKosztorysAsPreset(sourceId)
    const presetId = await insertPreset(db, {
      name: `${PRESET_PREFIX}${nameSuffix}`,
      createdBy: null,
      payload: payloadSnap,
    })
    const sectionId = payloadSnap.sections[0].id
    return { presetId: presetId!, sectionId }
  }

  const sectionsByOrder = (tree: SnapshotPayloadT) =>
    [...tree.sections].sort((a, b) => a.displayOrder - b.displayOrder)

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

  it('(a) appends a section after existing ones, values intact and job fields zeroed', async () => {
    const { presetId, sectionId } = await buildPreset('a', 'Malowanie')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-a`)
    await addSection(targetId, 'Istniejąca', 0)

    const result = await appendPresetSectionsAction(targetId, [{ presetId, sectionId }])
    expect(result.success).toBe(true)

    const after = await serializeKosztorys(targetId)
    const sections = sectionsByOrder(after)
    expect(sections.map((s) => s.name)).toEqual(['Istniejąca', 'Malowanie'])

    const appended = sections[1]
    expect(appended.displayOrder).toBe(1)
    expect(appended.wToolsCoeff).toBe(0.8)

    const item = after.items.find((it) => it.sectionId === appended.id)!
    expect(item.description).toBe('Praca w Malowanie')
    expect(item.unit).toBe('m2')
    expect(item.clientPrice).toBe(150)
    expect(item.wToolsOverrideType).toBe('coeff')
    expect(item.wToolsOverrideValue).toBe(0.65)
    // Job fields zeroed at serialize time — the append inserts the cleaned values verbatim.
    expect(item.plannedQty).toBe(0)
    expect(item.discountType).toBeNull()
    expect(item.discountValue).toBe(0)
    expect(item.hiddenInExport).toBe(false)
    expect(item.note).toBeNull()
  })

  it('(b) one call appends two sections from two different presets, in selection order', async () => {
    const first = await buildPreset('b1', 'Sekcja B1')
    const second = await buildPreset('b2', 'Sekcja B2')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-b`)
    const result = await appendPresetSectionsAction(targetId, [
      { presetId: first.presetId, sectionId: first.sectionId },
      { presetId: second.presetId, sectionId: second.sectionId },
    ])
    expect(result.success).toBe(true)

    const after = await serializeKosztorys(targetId)
    const sections = sectionsByOrder(after)
    expect(sections.map((s) => s.name)).toEqual(['Sekcja B1', 'Sekcja B2'])
    expect(sections.map((s) => s.displayOrder)).toEqual([0, 1])
  })

  it('(c) appends into an empty kosztorys (no empty-guard)', async () => {
    const { presetId, sectionId } = await buildPreset('c', 'Sekcja C')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-c`)
    const result = await appendPresetSectionsAction(targetId, [{ presetId, sectionId }])
    expect(result.success).toBe(true)

    const after = await serializeKosztorys(targetId)
    expect(after.sections.map((s) => s.name)).toEqual(['Sekcja C'])
    expect(after.sections[0].displayOrder).toBe(0)
    expect(after.items).toHaveLength(1)
  })

  it('(d) unknown sectionId → error and nothing persisted', async () => {
    const { presetId } = await buildPreset('d', 'Sekcja D')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-d`)
    await addSection(targetId, 'Nietknięta', 0)
    const before = await serializeKosztorys(targetId)

    const result = await appendPresetSectionsAction(targetId, [{ presetId, sectionId: 999_999 }])
    expect(result.success).toBe(false)

    const after = await serializeKosztorys(targetId)
    // The unknown section is rejected before any write — the pre-existing tree is untouched.
    expect(after.sections.map((s) => s.name)).toEqual(before.sections.map((s) => s.name))
    expect(after.items).toHaveLength(before.items.length)
  })

  it('(e) appending a section whose name already exists in the target succeeds', async () => {
    const { presetId, sectionId } = await buildPreset('e', 'Łazienka')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-e`)
    await addSection(targetId, 'Łazienka', 0)

    const result = await appendPresetSectionsAction(targetId, [{ presetId, sectionId }])
    expect(result.success).toBe(true)

    const after = await serializeKosztorys(targetId)
    expect(after.sections.filter((s) => s.name === 'Łazienka')).toHaveLength(2)
  })
})
