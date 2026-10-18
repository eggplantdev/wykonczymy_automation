import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type { WorkCatalogueItemDataT } from '@/components/forms/work-catalogue-item/work-catalogue-item-schema'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/first-user-id'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const { createCatalogueItemAction, updateCatalogueItemAction, deleteCatalogueItemAction } =
  await import('@/lib/actions/work-catalogue')

describe.skipIf(!ENV_READY)('work catalogue actions (DB)', () => {
  let payload: Payload
  let suffix = ''
  const createdIds: number[] = []

  const item = (overrides: Partial<WorkCatalogueItemDataT> = {}): WorkCatalogueItemDataT => ({
    description: `Malowanie ścian ${suffix}`,
    category: 'Malowanie',
    unit: 'm²',
    clientPrice: 40,
    wToolsRate: 20,
    wToolsRateCoeff: null,
    ownToolsRate: 15,
    ownToolsRateCoeff: null,
    ...overrides,
  })

  const rowsFor = async (data: WorkCatalogueItemDataT) =>
    (
      await payload.find({
        collection: 'work-catalogue-items',
        where: { matchKey: { equals: catalogueKey(data.description, data.unit) } },
        depth: 0,
        limit: 10,
        overrideAccess: true,
      })
    ).docs

  const track = async (data: WorkCatalogueItemDataT) => {
    const [row] = await rowsFor(data)
    if (row) createdIds.push(Number(row.id))
    return row
  }

  beforeAll(async () => {
    payload = await bootTestPayload()

    authState.userId = await firstUserId(payload)

    suffix = `TEST-${Date.now()}`
  })

  afterAll(async () => {
    for (const id of createdIds) {
      await payload.delete({ collection: 'work-catalogue-items', id }).catch(() => undefined)
    }
  })

  it('derives matchKey from opis + j.m., ignoring anything the client sends', async () => {
    const data = item()
    const result = await createCatalogueItemAction({
      ...data,
      matchKey: 'cokolwiek',
    } as WorkCatalogueItemDataT)
    expect(result.success).toBe(true)

    const row = await track(data)
    expect(row?.matchKey).toBe(catalogueKey(data.description, data.unit))
  })

  it('refuses a duplicate opis+j.m. and writes NO second row', async () => {
    const duplicate = item({ description: `MALOWANIE SCIAN ${suffix}`, clientPrice: 99 })

    const result = await createCatalogueItemAction(duplicate)
    expect(result.success).toBe(false)

    const rows = await rowsFor(duplicate)
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!.clientPrice)).toBe(40)
  })

  it('lets the same opis in a different j.m. through', async () => {
    const perPiece = item({ unit: 'szt', clientPrice: 12 })

    const result = await createCatalogueItemAction(perPiece)
    expect(result.success).toBe(true)

    const row = await track(perPiece)
    expect(Number(row!.clientPrice)).toBe(12)
  })

  it('re-derives matchKey on edit and refuses an edit that collides with another row', async () => {
    const [existing] = await rowsFor(item({ unit: 'szt' }))
    const id = Number(existing!.id)

    const collide = await updateCatalogueItemAction(id, item({ unit: 'm²' }))
    expect(collide.success).toBe(false)

    const stored = await payload.findByID({ collection: 'work-catalogue-items', id, depth: 0 })
    expect(stored.unit).toBe('szt')
  })

  it('saves an unchanged row without colliding with itself', async () => {
    const [existing] = await rowsFor(item({ unit: 'szt' }))
    const id = Number(existing!.id)

    const result = await updateCatalogueItemAction(id, item({ unit: 'szt', clientPrice: 13 }))
    expect(result.success).toBe(true)

    const stored = await payload.findByID({ collection: 'work-catalogue-items', id, depth: 0 })
    expect(Number(stored.clientPrice)).toBe(13)
  })

  it('zmiana kwoty na „auto" zapisuje NULL, a nie 0 zł', async () => {
    const [existing] = await rowsFor(item({ unit: 'szt' }))
    const id = Number(existing!.id)

    const result = await updateCatalogueItemAction(id, item({ unit: 'szt', wToolsRate: null }))
    expect(result.success).toBe(true)

    const stored = await payload.findByID({ collection: 'work-catalogue-items', id, depth: 0 })
    expect(stored.wToolsRate).toBeNull()
    expect(Number(stored.ownToolsRate)).toBe(15)
  })

  it('a price-only edit from a dialog opened before the translations existed keeps them', async () => {
    const data = item({ unit: 'mb' })
    expect((await createCatalogueItemAction(data)).success).toBe(true)
    const row = await track(data)
    const id = Number(row!.id)
    // Translations land behind the dialog's back — the fill script writes raw SQL, no cache expiry.
    await payload.update({
      collection: 'work-catalogue-items',
      id,
      data: {
        descriptionTranslations: { uk: { text: 'Фарбування стін', source: data.description } },
      },
    })

    const result = await updateCatalogueItemAction(id, {
      ...data,
      clientPrice: 41,
      translationSeed: {},
      translationEdits: {},
    })
    expect(result.success).toBe(true)

    const stored = await payload.findByID({ collection: 'work-catalogue-items', id, depth: 0 })
    expect(Number(stored.clientPrice)).toBe(41)
    expect(stored.descriptionTranslations).toEqual({
      uk: { text: 'Фарбування стін', source: data.description },
    })
  })

  it('an edited language is stamped against the opis; the others stay as stored', async () => {
    const data = item({ unit: 'mb' })
    const [row] = await rowsFor(data)
    const id = Number(row!.id)

    const result = await updateCatalogueItemAction(id, {
      ...data,
      translationSeed: {},
      translationEdits: { ru: 'Покраска стен' },
    })
    expect(result.success).toBe(true)

    const stored = await payload.findByID({ collection: 'work-catalogue-items', id, depth: 0 })
    expect(stored.descriptionTranslations).toEqual({
      uk: { text: 'Фарбування стін', source: data.description },
      ru: { text: 'Покраска стен', source: data.description },
    })
  })
})
