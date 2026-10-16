import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { appendPresetSectionsAction } from '@/lib/actions/kosztorys-presets'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createTestTemplate } from '@/__tests__/helpers/template'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PRESET_PREFIX = 'append-spec-'

describe.skipIf(!ENV_READY)('appendPresetSections (DB)', () => {
  let payload: Payload
  const investmentIds: number[] = []

  async function createInvestment(name: string) {
    const id = await createTestInvestment(payload, name, { wToolsCoeff: 0.7, ownToolsCoeff: 0.5 })
    investmentIds.push(id)
    return id
  }

  async function addSection(
    investmentId: number,
    name: string,
    displayOrder: number,
    color: string | null = null,
  ) {
    const { sectionIds } = await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name,
          displayOrder,
          color,
          items: [
            {
              description: `Praca w ${name}`,
              unit: 'm2',
              plannedQty: 12,
              clientPrice: 150,
              discountType: 'percent',
              discountValue: 10,
              wToolsOverrideValue: 97.5,
              note: 'uwaga',
            },
          ],
        },
      ],
    })
    return sectionIds[0]
  }

  async function buildPreset(nameSuffix: string, sectionName: string, color: string | null = null) {
    const presetId = await createTestTemplate(payload, `${PRESET_PREFIX}${nameSuffix}`)
    investmentIds.push(presetId)
    const sectionId = await addSection(presetId, sectionName, 0, color)
    return { sectionId }
  }

  const sectionsByOrder = (tree: SnapshotPayloadT) =>
    [...tree.sections].sort((a, b) => a.displayOrder - b.displayOrder)

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

  it('(a) appends a section after existing ones, values intact and job fields zeroed', async () => {
    const { sectionId } = await buildPreset('a', 'Malowanie')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-a`)
    await addSection(targetId, 'Istniejąca', 0)

    const result = await appendPresetSectionsAction(targetId, [sectionId])
    expect(result.success).toBe(true)

    const after = await serializeKosztorys(targetId)
    const sections = sectionsByOrder(after)
    expect(sections.map((s) => s.name)).toEqual(['Istniejąca', 'Malowanie'])

    const appended = sections[1]
    expect(appended.displayOrder).toBe(1)

    const item = after.items.find((it) => it.sectionId === appended.id)!
    expect(item.description).toBe('Praca w Malowanie')
    expect(item.unit).toBe('m2')
    expect(item.clientPrice).toBe(150)
    expect(item.wToolsOverrideValue).toBe(97.5)
    expect(item.plannedQty).toBe(0)
    expect(item.discountType).toBeNull()
    expect(item.discountValue).toBe(0)
    expect(item.note).toBeNull()
  })

  it('(b) one call appends two sections from two different presets, in selection order', async () => {
    const first = await buildPreset('b1', 'Sekcja B1')
    const second = await buildPreset('b2', 'Sekcja B2')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-b`)
    const result = await appendPresetSectionsAction(targetId, [first.sectionId, second.sectionId])
    expect(result.success).toBe(true)

    const after = await serializeKosztorys(targetId)
    const sections = sectionsByOrder(after)
    expect(sections.map((s) => s.name)).toEqual(['Sekcja B1', 'Sekcja B2'])
    expect(sections.map((s) => s.displayOrder)).toEqual([0, 1])
  })

  it('(c) appends into an empty kosztorys (no empty-guard)', async () => {
    const { sectionId } = await buildPreset('c', 'Sekcja C')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-c`)
    const result = await appendPresetSectionsAction(targetId, [sectionId])
    expect(result.success).toBe(true)

    const after = await serializeKosztorys(targetId)
    expect(after.sections.map((s) => s.name)).toEqual(['Sekcja C'])
    expect(after.sections[0].displayOrder).toBe(0)
    expect(after.items).toHaveLength(1)
  })

  it('(d) unknown sectionId → error and nothing persisted', async () => {
    await buildPreset('d', 'Sekcja D')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-d`)
    await addSection(targetId, 'Nietknięta', 0)
    const before = await serializeKosztorys(targetId)

    const result = await appendPresetSectionsAction(targetId, [999_999])
    expect(result.success).toBe(false)

    const after = await serializeKosztorys(targetId)
    expect(after.sections.map((s) => s.name)).toEqual(before.sections.map((s) => s.name))
    expect(after.items).toHaveLength(before.items.length)
  })

  it('(e) appending a section whose name already exists in the target succeeds', async () => {
    const { sectionId } = await buildPreset('e', 'Łazienka')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-e`)
    await addSection(targetId, 'Łazienka', 0)

    const result = await appendPresetSectionsAction(targetId, [sectionId])
    expect(result.success).toBe(true)

    const after = await serializeKosztorys(targetId)
    expect(after.sections.filter((s) => s.name === 'Łazienka')).toHaveLength(2)
  })

  it('(f) the section colour survives the preset round trip', async () => {
    const { sectionId } = await buildPreset('f', 'Sekcja F', 'teal-deep')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-f`)
    const result = await appendPresetSectionsAction(targetId, [sectionId])
    expect(result.success).toBe(true)

    const after = await serializeKosztorys(targetId)
    expect(after.sections.find((s) => s.name === 'Sekcja F')?.color).toBe('teal-deep')
  })

  it('(g) an unpinned section round-trips as unpinned, not as a dropped column', async () => {
    const { sectionId } = await buildPreset('g', 'Sekcja G')

    const targetId = await createInvestment(`${PRESET_PREFIX}target-g`)
    await appendPresetSectionsAction(targetId, [sectionId])

    const after = await serializeKosztorys(targetId)
    expect(after.sections.find((s) => s.name === 'Sekcja G')?.color).toBeNull()
  })

  it('(h) refuses a section of an ordinary investment and persists nothing', async () => {
    const sourceId = await createInvestment(`${PRESET_PREFIX}not-a-template`)
    const sectionId = await addSection(sourceId, 'Klienta', 0)

    const targetId = await createInvestment(`${PRESET_PREFIX}target-h`)
    const result = await appendPresetSectionsAction(targetId, [sectionId])

    expect(result).toEqual({ success: false, error: 'Nie znaleziono sekcji w szablonie' })
    expect((await serializeKosztorys(targetId)).sections).toHaveLength(0)
  })
})
