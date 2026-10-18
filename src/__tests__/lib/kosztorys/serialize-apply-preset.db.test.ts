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
import { canonicalTree } from '@/__tests__/helpers/canonical-snapshot'
import {
  addTestTemplateSection,
  createTestCatalogueEntry,
  createTestTemplate,
  deleteTestCatalogueEntries,
  deleteTestTemplate,
} from '@/__tests__/helpers/template'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

// serializeKosztorys reads through getKosztorysTree, whose DAL guard self-authorizes via requireAuth →
// cookies(), which has no request scope in node.
vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const PRESET_PREFIX = 'preset-spec-'
const ZEROED_JOB_FIGURES = { plannedQty: 0, discountType: null, discountValue: 0 }

const canonicalPreset = (snap: StoredSnapshotPayloadT) => canonicalTree(snap, { dropRef: true })

describe.skipIf(!ENV_READY)('serialize → apply preset (DB)', () => {
  let payload: Payload
  const investmentIds: number[] = []

  async function createInvestment(name: string, vat: number, wCoeff: number, oCoeff: number) {
    const id = await createTestInvestment(payload, name, {
      vatRate: vat,
      wToolsCoeff: wCoeff,
      ownToolsCoeff: oCoeff,
    })
    investmentIds.push(id)
    return id
  }

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
              aiMissingData: 'brak rzutu',
              aiAssumptions: 'przyjęto 2,6 m wysokości',
              aiNewInformation: 'Runda 2 — projekt podaje 2,8 m',
              aiRecheck: true,
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

  const templateIds: number[] = []
  const entryIds: number[] = []

  // A szablon of two sekcje and three katalog prace.
  async function createTemplateWithItems(name: string) {
    const id = await createTestTemplate(payload, `${PRESET_PREFIX}${name}`)
    templateIds.push(id)
    const entries = [
      await createTestCatalogueEntry(payload, 'Malowanie', { clientPrice: 30 }),
      await createTestCatalogueEntry(payload, 'Gruntowanie', { clientPrice: 10 }),
      await createTestCatalogueEntry(payload, 'Płytki', { clientPrice: 120 }),
    ]
    entryIds.push(...entries)
    await addTestTemplateSection(payload, id, 'Salon', entries.slice(0, 2))
    await addTestTemplateSection(payload, id, 'Łazienka', entries.slice(2), { displayOrder: 1 })
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
    payload = await bootTestPayload()
  })

  afterAll(async () => {
    for (const id of investmentIds) {
      await deleteTestInvestment(payload, id)
    }
    for (const id of templateIds) await deleteTestTemplate(payload, id)
    await deleteTestCatalogueEntries(payload, entryIds)
  })

  it('apply(serializeAsPreset()) reproduces the structural tree, zeroes the job figures and the komentarz, leaves target settings', async () => {
    const sourceId = await createInvestment(`${PRESET_PREFIX}source-roundtrip`, 0.23, 0.7, 0.5)
    await buildSourceTree(sourceId)

    const preset = await serializeKosztorysAsPreset(sourceId)

    const targetId = await createInvestment(`${PRESET_PREFIX}target-roundtrip`, 0.08, 0.9, 0.6)
    await applyPresetTx(targetId, preset)

    const after = await serializeKosztorys(targetId)

    expect(canonicalPreset(after)).toEqual(canonicalPreset(preset))

    for (const item of after.items) {
      expect(item).toMatchObject({
        ...ZEROED_JOB_FIGURES,
        sheetMeasuredQty: null,
        aiPlannedQty: null,
        aiMissingData: null,
        aiAssumptions: null,
        aiNewInformation: null,
        aiRecheck: false,
        changeReason: null,
        reviewStatus: null,
      })
    }
    expect(after.items.find((item) => item.description === 'Malowanie')!.note).toBeNull()
    expect(after.progress).toEqual([])

    expect(after.settings).toEqual({
      wToolsCoeff: 0.9,
      ownToolsCoeff: 0.6,
      vatRate: 0.08,
    })
  })

  it('seed from a szablon yields its prace, with no etapy, no progress, no przedmiar and no rabat', async () => {
    const presetId = await createTemplateWithItems('oneetap')

    const spawnId = await createInvestment(`${PRESET_PREFIX}spawn-oneetap`, 0.23, 0.7, 0.5)
    expect(await seedInvestmentFromPreset(payload, spawnId, presetId)).toBe('ok')

    const after = await serializeKosztorys(spawnId)
    expect(after.stages).toEqual([])
    expect(after.progress).toEqual([])
    expect(after.sections.map((section) => section.name)).toEqual(['Salon', 'Łazienka'])
    expect(after.items).toHaveLength(3)
    for (const item of after.items) expect(item).toMatchObject(ZEROED_JOB_FIGURES)
  })

  it('seed onto an investment that already has etapy keeps them and adds none', async () => {
    const presetId = await createTemplateWithItems('hasetapy')

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
    const presetId = await createTemplateWithItems('guard')

    const occupiedId = await createInvestment(`${PRESET_PREFIX}target-guard`, 0.23, 0.7, 0.5)
    await createKosztorysTree(payload, occupiedId, { sections: [{ name: 'Istniejąca' }] })

    const before = await serializeKosztorys(occupiedId)
    const result = await seedInvestmentFromPreset(payload, occupiedId, presetId)
    const after = await serializeKosztorys(occupiedId)

    expect(result).toBe('not-empty')
    expect(canonicalPreset(after)).toEqual(canonicalPreset(before))
  })

  it('seed refuses a source that is not a live szablon and writes nothing', async () => {
    const targetId = await createInvestment(`${PRESET_PREFIX}target-ordinary`, 0.23, 0.7, 0.5)

    expect(await seedInvestmentFromPreset(payload, targetId, 2_000_000_000)).toBe('not-found')
    expect((await serializeKosztorys(targetId)).sections).toEqual([])
  })

  it('editing a szablon never propagates to a tree already spawned from it', async () => {
    const presetId = await createTemplateWithItems('frozen')

    const spawnId = await createInvestment(`${PRESET_PREFIX}spawn-frozen`, 0.23, 0.7, 0.5)
    expect(await seedInvestmentFromPreset(payload, spawnId, presetId)).toBe('ok')
    const spawnBefore = await serializeKosztorys(spawnId)

    // The szablon grows a section after the spawn.
    await addTestTemplateSection(payload, presetId, 'Nowa treść', [], { displayOrder: 2 })

    const spawnAfter = await serializeKosztorys(spawnId)
    expect(canonicalPreset(spawnAfter)).toEqual(canonicalPreset(spawnBefore))
  })
})
