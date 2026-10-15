import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { SNAPSHOT_SCHEMA_VERSION, type SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import {
  addTestTemplateSection,
  createTestCatalogueEntry,
  createTestTemplate,
  deleteTestCatalogueEntries,
  deleteTestTemplate,
} from '@/__tests__/helpers/template'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

// „Wczytaj szablon" replaces a whole rozpiska behind an automatic snapshot, so every assertion is on
// PERSISTED state: a success result would hide a failed write, and „odwracalne" is real only if the
// pre-reload snapshot actually restores.

const authState = vi.hoisted(() => ({ userId: 0 }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

// A live szablon cannot hold a tree that breaks on insert — its own unique indexes stop it — so the
// rollback case swaps in a serialized tree whose etapy collide on (investment_id, ordinal), the
// cheapest way to make `restoreKosztorys` throw AFTER the wipe and the snapshot insert.
const serializeControl = vi.hoisted(() => ({ brokenId: 0, broken: null as unknown }))
vi.mock('@/lib/kosztorys/templates/serialize-template', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/kosztorys/templates/serialize-template')>()
  return {
    ...actual,
    serializeTemplate: vi.fn(async (...args: Parameters<typeof actual.serializeTemplate>) =>
      args[1] === serializeControl.brokenId
        ? (serializeControl.broken as SnapshotPayloadT)
        : actual.serializeTemplate(...args),
    ),
  }
})

const { createEmptyPresetAction, reloadFromPresetAction, renamePresetAction, savePresetAction } =
  await import('@/lib/actions/kosztorys-presets')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const NAME_TAKEN_MESSAGE = 'Szablon o tej nazwie już istnieje'
const NAME_IN_TRASH_MESSAGE = 'Szablon o tej nazwie jest w koszu — przywróć go albo usuń na zawsze.'

// Szablon names are unique across the whole shared DB, so every run takes its own.
const uniqueName = (name: string) => `${name} ${crypto.randomUUID().slice(0, 8)}`

const INVESTMENT_VAT = 8
const INVESTMENT_COEFFS = { wToolsCoeff: 1.4, ownToolsCoeff: 1.7 }
const INVESTMENT_DISCOUNT = 5000

function brokenPresetPayload(): SnapshotPayloadT {
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sections: [{ id: 1, name: 'Z szablonu', displayOrder: 0, color: null }],
    items: [],
    stages: [
      makeStage({ id: 1, ordinal: 1, label: 'Etap 1', plane: null }),
      makeStage({ id: 2, ordinal: 1, label: 'Etap 1 znowu', plane: null }),
    ],
    progress: [],
    settings: { wToolsCoeff: 1, ownToolsCoeff: 1, vatRate: 23 },
  }
}

async function firstUserId(payload: Payload): Promise<number> {
  const users = await payload.find({
    collection: 'users',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const firstUser = users.docs[0]
  if (!firstUser) throw new Error('no user in the DB to attribute the action to')
  return Number(firstUser.id)
}

describe.skipIf(!ENV_READY)('reloadFromPresetAction — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let presetId: number
  let presetName: string
  let brokenPresetId: number
  let entryId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)

    investmentId = await createTestInvestment(payload, 'ex560-reload-preset-test', {
      vatRate: INVESTMENT_VAT,
      wToolsCoeff: INVESTMENT_COEFFS.wToolsCoeff,
      ownToolsCoeff: INVESTMENT_COEFFS.ownToolsCoeff,
    })

    entryId = await createTestCatalogueEntry(payload, 'Praca z szablonu', { clientPrice: 100 })
    presetId = await createTestTemplate(payload, 'ex560-reload-fixture')
    presetName = String(
      (await db.execute(sql`SELECT name FROM templates WHERE id = ${presetId}`)).rows[0].name,
    )
    await addTestTemplateSection(payload, presetId, 'Z szablonu', [entryId])
    brokenPresetId = await createTestTemplate(payload, 'ex560-reload-fixture-broken')
    serializeControl.brokenId = brokenPresetId
    serializeControl.broken = brokenPresetPayload()
  })

  afterAll(async () => {
    for (const id of [investmentId]) {
      if (id) await deleteTestInvestment(payload, id)
    }
    for (const id of [presetId, brokenPresetId]) {
      if (id) await deleteTestTemplate(payload, id)
    }
    await deleteTestCatalogueEntries(payload, [entryId])
  })

  // Every kind of row the wipe has to reach, so a partial wipe can't pass.
  async function seedLiveTree(): Promise<void> {
    await payload.delete({
      collection: 'kosztorys-sections',
      where: { investment: { equals: investmentId } },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'kosztorys-stages',
      where: { investment: { equals: investmentId } },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })

    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: { investment: investmentId, name: 'Stan sprzed wczytania', displayOrder: 0 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: Number(section.id),
        displayOrder: 0,
        description: 'Praca wpisana ręcznie',
        unit: 'm2',
        plannedQty: 12,
        clientPrice: 50,
        discountValue: 0,
      },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    const stage = await payload.create({
      collection: 'kosztorys-stages',
      data: { splitMode: 'percent', investment: investmentId, ordinal: 1, label: 'Etap 1' },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'stage-progress',
      data: { item: Number(item.id), stage: Number(stage.id), qtyDone: 4 },
      context: { skipRevalidation: true },
      overrideAccess: true,
    })
  }

  async function sectionNames(): Promise<string[]> {
    const res = await db.execute(sql`
      SELECT name FROM kosztorys_sections WHERE investment_id = ${investmentId} ORDER BY display_order
    `)
    return res.rows.map((row) => String(row.name))
  }

  async function stageLabels(): Promise<string[]> {
    const res = await db.execute(sql`
      SELECT label FROM kosztorys_stages WHERE investment_id = ${investmentId} ORDER BY ordinal
    `)
    return res.rows.map((row) => String(row.label))
  }

  async function progressQty(): Promise<number[]> {
    const res = await db.execute(sql`
      SELECT sp.qty_done FROM stage_progress sp
      JOIN kosztorys_stages st ON st.id = sp.stage_id
      WHERE st.investment_id = ${investmentId}
    `)
    return res.rows.map((row) => Number(row.qty_done))
  }

  async function investmentSettings() {
    const res = await db.execute(sql`
      SELECT vat_rate, w_tools_coeff, own_tools_coeff, global_discount_type, global_discount_value
      FROM investments WHERE id = ${investmentId}
    `)
    const row = res.rows[0]
    return {
      vatRate: Number(row.vat_rate),
      wToolsCoeff: Number(row.w_tools_coeff),
      ownToolsCoeff: Number(row.own_tools_coeff),
      discountType: row.global_discount_type,
      discountValue: Number(row.global_discount_value),
    }
  }

  async function setGlobalDiscount(value: number): Promise<void> {
    await db.execute(sql`
      UPDATE investments
      SET global_discount_type = 'amount', global_discount_value = ${value}
      WHERE id = ${investmentId}
    `)
  }

  async function preReloadSnapshotIds(): Promise<number[]> {
    const res = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId}
        AND kind = 'manual'
        AND label = ${`Przed wczytaniem: ${presetName}`}
      ORDER BY id DESC
    `)
    return res.rows.map((row) => Number(row.id))
  }

  async function allSnapshotIds(): Promise<number[]> {
    const res = await db.execute(sql`
      SELECT id FROM kosztorys_snapshots WHERE investment_id = ${investmentId} ORDER BY id
    `)
    return res.rows.map((row) => Number(row.id))
  }

  it('replaces the whole rozpiska with the szablon, etapy and wykonano included', async () => {
    await seedLiveTree()

    const result = await reloadFromPresetAction(investmentId, presetId)

    expect(result).toMatchObject({ success: true, data: { sections: 1, items: 1 } })
    expect(await sectionNames()).toEqual(['Z szablonu'])
    // A szablon carries no etapy, so both go — this is the part that distinguishes a reload from the
    // sheet import, which keeps prace the sheet doesn't know about.
    expect(await stageLabels()).toEqual([])
    expect(await progressQty()).toEqual([])
  })

  // A szablon praca is a katalog ref, so the copy takes the katalog's cena at this moment and
  // starts the job with no przedmiar and no rabat.
  it('takes the szablon’s prace at the katalog price, with no przedmiar and no rabat', async () => {
    await seedLiveTree()

    await reloadFromPresetAction(investmentId, presetId)

    const res = await db.execute(sql`
      SELECT planned_qty, discount_type, discount_value, client_price FROM kosztorys_items
      WHERE investment_id = ${investmentId}
    `)
    expect(res.rows.map((row) => Number(row.client_price))).toEqual([100])
    expect(res.rows[0]).toMatchObject({ discount_type: null })
    expect(Number(res.rows[0].planned_qty)).toBe(0)
    expect(Number(res.rows[0].discount_value)).toBe(0)
  })

  // A szablon carries no pricing config; the defaults its serializer fills in must not land on a job
  // that set its own — `restoreKosztorys` is handed the CURRENT settings instead.
  it('leaves the investment’s own VAT and coefficients alone', async () => {
    await seedLiveTree()

    await reloadFromPresetAction(investmentId, presetId)

    expect(await investmentSettings()).toMatchObject({
      vatRate: INVESTMENT_VAT,
      ...INVESTMENT_COEFFS,
    })
  })

  // A szablon's przedmiar is all zeroes, so a surviving amount discount would price the fresh
  // rozpiska below nothing — `globalDiscountAmount` is deliberately unclamped (calc.ts).
  it('zeroes the rabat globalny, which would otherwise outlive the work it discounts', async () => {
    await seedLiveTree()
    await setGlobalDiscount(INVESTMENT_DISCOUNT)

    await reloadFromPresetAction(investmentId, presetId)

    expect(await investmentSettings()).toMatchObject({ discountType: null, discountValue: 0 })
  })

  // Found by LABEL, not by „newest": the whole point of the pre-reload row being `manual` is that it
  // survives the auto count cap + 7-day GC and stays identifiable among the periodic autosaves.
  it('takes a labelled pre-reload snapshot that restores the rozpiska it replaced', async () => {
    await seedLiveTree()

    await reloadFromPresetAction(investmentId, presetId)
    expect(await sectionNames()).not.toContain('Stan sprzed wczytania')

    const snapshotIds = await preReloadSnapshotIds()
    expect(snapshotIds.length).toBeGreaterThan(0)

    const { restoreSnapshotAction } = await import('@/lib/actions/kosztorys-snapshots')
    await restoreSnapshotAction(snapshotIds[0], investmentId)

    expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
    // Etapy and wykonano come back too — the snapshot is the undo for the whole tree, not just the
    // prace, which is what makes the wipe safe to offer without an escalated warning.
    expect(await stageLabels()).toEqual(['Etap 1'])
    expect(await progressQty()).toEqual([4])
  })

  it.each([['does not exist', () => 2_000_000_000]])(
    'writes nothing — not even a snapshot — when the source %s',
    async (_, sourceId) => {
      await seedLiveTree()
      const before = await allSnapshotIds()

      const result = await reloadFromPresetAction(investmentId, sourceId())

      expect(result).toMatchObject({ success: false, error: 'Nie znaleziono szablonu' })
      expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
      expect(await allSnapshotIds()).toEqual(before)
    },
  )

  // Thrown away means gone from „Wczytaj szablon" — an open picker must not still load it.
  it('writes nothing when the source szablon is in the trash', async () => {
    const trashed = await createTestTemplate(payload, 'ex560-reload-fixture-trashed')
    try {
      await addTestTemplateSection(payload, trashed, 'Z kosza', [entryId])
      await db.execute(sql`UPDATE templates SET trashed_at = now() WHERE id = ${trashed}`)
      await seedLiveTree()
      const before = await allSnapshotIds()

      expect(await reloadFromPresetAction(investmentId, trashed)).toMatchObject({
        success: false,
        error: 'Nie znaleziono szablonu',
      })
      expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
      expect(await allSnapshotIds()).toEqual(before)
    } finally {
      await deleteTestTemplate(payload, trashed)
    }
  })

  // The case above never enters the transaction. The snapshot is written on the transaction handle
  // BEFORE the wipe, so a throw during the insert must take it down rather than strand a restore
  // point for a state that was never replaced.
  it('rolls the pre-reload snapshot back when the insert itself throws', async () => {
    await seedLiveTree()
    const snapshotsBefore = await allSnapshotIds()

    const result = await reloadFromPresetAction(investmentId, brokenPresetId)

    expect(result).toMatchObject({ success: false })
    expect(await sectionNames()).toEqual(['Stan sprzed wczytania'])
    expect(await stageLabels()).toEqual(['Etap 1'])
    expect(await progressQty()).toEqual([4])
    expect(await allSnapshotIds()).toEqual(snapshotsBefore)
  })
})

// Every lifecycle assertion reads the templates rows and their layout — never the action's result
// alone.
describe.skipIf(!ENV_READY)('szablon lifecycle — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const investments: number[] = []
  const templates: number[] = []
  const entries: number[] = []
  let sourceId: number
  let sourceName: string
  // A szablon's prace are katalog entries, so the source's praca has to be one to travel at all.
  const tiles = uniqueName('Płytki')
  let tilesEntryId: number

  async function createEntry(description: string): Promise<number> {
    const entry = await payload.create({
      collection: 'work-catalogue-items',
      data: {
        description,
        unit: 'm2',
        clientPrice: 120,
        matchKey: catalogueKey(description, 'm2'),
      },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    entries.push(Number(entry.id))
    return Number(entry.id)
  }

  async function makeTemplate(name: string): Promise<number> {
    const id = await createTestTemplate(payload, name)
    templates.push(id)
    return id
  }

  const trash = (id: number) =>
    db.execute(sql`UPDATE templates SET trashed_at = now() WHERE id = ${id}`)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)

    tilesEntryId = await createEntry(tiles)
    sourceName = uniqueName('lifecycle-source')
    sourceId = await createTestInvestment(payload, sourceName)
    investments.push(sourceId)
    await createKosztorysTree(payload, sourceId, {
      sections: [
        {
          name: 'Łazienka',
          items: [
            {
              description: tiles,
              unit: 'm2',
              plannedQty: 14,
              clientPrice: 120,
              discountType: 'amount',
              discountValue: 50,
              catalogueItemId: tilesEntryId,
            },
          ],
        },
      ],
      stages: [{ label: 'Etap 1' }],
    })
  })

  afterAll(async () => {
    for (const id of investments) await deleteTestInvestment(payload, id)
    for (const id of templates) await deleteTestTemplate(payload, id)
    await deleteTestCatalogueEntries(payload, entries)
  })

  async function templateByName(name: string) {
    const res = await db.execute(sql`
      SELECT id, content_edited_at FROM templates WHERE name = ${name}
    `)
    for (const row of res.rows) templates.push(Number(row.id))
    return res.rows
  }

  // A szablon's layout: sekcje in order, each with the katalog descriptions of its prace.
  async function layoutOf(id: number) {
    const res = await db.execute(sql`
      SELECT s.name,
             coalesce(array_agg(w.description ORDER BY i.display_order, i.id)
                        FILTER (WHERE i.id IS NOT NULL), '{}') AS prace
      FROM template_sections s
      LEFT JOIN template_items i ON i.section_id = s.id
      LEFT JOIN work_catalogue_items w ON w.id = i.catalogue_item_id
      WHERE s.template_id = ${id}
      GROUP BY s.id
      ORDER BY s.display_order, s.id
    `)
    return res.rows.map((row) => ({
      name: String(row.name),
      prace: (row.prace as unknown[]).map(String),
    }))
  }

  async function versionLabels(id: number) {
    const res = await db.execute(sql`
      SELECT label FROM template_snapshots WHERE template_id = ${id} ORDER BY id
    `)
    return res.rows.map((row) => row.label)
  }

  const SOURCE_LAYOUT = () => [{ name: 'Łazienka', prace: [tiles] }]

  // Never written into the katalog on the way: that would put one client's price in the cennik.
  it.each(['new', 'overwrite'] as const)(
    '„%s” leaves out a praca typed by hand, says how many, and adds nothing to the katalog',
    async (mode) => {
      const typed = uniqueName('Wpisana ręcznie')
      const linked = uniqueName('Z katalogu')
      const mixedSource = await createTestInvestment(payload, uniqueName('lifecycle-mixed'))
      investments.push(mixedSource)
      await createKosztorysTree(payload, mixedSource, {
        sections: [
          {
            name: 'Kuchnia',
            items: [
              { description: linked, unit: 'm2', catalogueItemId: await createEntry(linked) },
              { description: typed, unit: 'm2' },
            ],
          },
        ],
      })
      const name = uniqueName('lifecycle-mixed-target')
      const targetId = mode === 'overwrite' ? await makeTemplate(name) : undefined

      const result = await savePresetAction(
        mixedSource,
        targetId ? { mode: 'overwrite', targetId } : { mode: 'new', name },
      )

      expect(result).toEqual({
        success: true,
        warning: 'Pominięto 1 pracę spoza katalogu — najpierw zapisz je do katalogu.',
      })
      const presetId = targetId ?? Number((await templateByName(name))[0].id)
      expect(await layoutOf(presetId)).toEqual([{ name: 'Kuchnia', prace: [linked] }])
      const typedInCatalogue = await db.execute(sql`
        SELECT 1 FROM work_catalogue_items WHERE match_key = ${catalogueKey(typed, 'm2')}
      `)
      expect(typedInCatalogue.rows).toHaveLength(0)
    },
  )

  it('an empty szablon is a stamped templates row with no layout', async () => {
    const name = uniqueName('lifecycle-empty')

    const result = await createEmptyPresetAction(name)

    const rows = await templateByName(name)
    expect(rows).toHaveLength(1)
    // Stamped, or a new szablon would sort below every edited one on the list it was made from.
    expect(rows[0].content_edited_at).not.toBeNull()
    expect(result).toEqual({ success: true, data: { id: Number(rows[0].id) } })
    expect(await layoutOf(Number(rows[0].id))).toEqual([])
  })

  it('„Zapisz jako nowy” founds a szablon with the source’s sekcje and katalog prace', async () => {
    const name = uniqueName('lifecycle-new')

    expect(await savePresetAction(sourceId, { mode: 'new', name })).toEqual({ success: true })

    const rows = await templateByName(name)
    expect(rows).toHaveLength(1)
    expect(await layoutOf(Number(rows[0].id))).toEqual(SOURCE_LAYOUT())
  })

  // The unique index compares lower(trim(name)); the actions have to say so in Polish before the
  // driver answers with an English 23505.
  it.each([
    ['other case', (name: string) => name.toUpperCase()],
    ['edge spaces', (name: string) => `  ${name}  `],
  ])('refuses a taken name (%s) on every path that names a szablon', async (_, variant) => {
    const taken = await makeTemplate('lifecycle-taken')
    const takenName = String(
      (await db.execute(sql`SELECT name FROM templates WHERE id = ${taken}`)).rows[0].name,
    )
    const other = await makeTemplate('lifecycle-rename-me')

    const refused = { success: false, error: NAME_TAKEN_MESSAGE }
    expect(await createEmptyPresetAction(variant(takenName))).toEqual(refused)
    expect(await savePresetAction(sourceId, { mode: 'new', name: variant(takenName) })).toEqual(
      refused,
    )
    expect(await renamePresetAction(other, variant(takenName))).toEqual(refused)

    const sameName = await db.execute(sql`
      SELECT id FROM templates WHERE lower(trim(name)) = lower(${takenName})
    `)
    expect(sameName.rows.map((row) => Number(row.id))).toEqual([taken])
  })

  it('refuses a trashed szablon’s name, pointing at the trash, on every path that names a szablon', async () => {
    const trashed = await makeTemplate('lifecycle-trashed')
    const trashedName = String(
      (await db.execute(sql`SELECT name FROM templates WHERE id = ${trashed}`)).rows[0].name,
    )
    const other = await makeTemplate('lifecycle-rename-into-trash')
    await trash(trashed)

    const refused = { success: false, error: NAME_IN_TRASH_MESSAGE }
    expect(await createEmptyPresetAction(trashedName)).toEqual(refused)
    expect(await savePresetAction(sourceId, { mode: 'new', name: trashedName })).toEqual(refused)
    expect(await renamePresetAction(other, trashedName)).toEqual(refused)

    const sameName = await db.execute(sql`
      SELECT id FROM templates WHERE lower(trim(name)) = lower(${trashedName})
    `)
    expect(sameName.rows.map((row) => Number(row.id))).toEqual([trashed])
  })

  // A stale /szablony tab renames a szablon another tab already trashed, into a name someone holds:
  // the name clash is not why the rename failed, and saying so sends the owner to pick another name.
  it('renaming a szablon that is not live says it is gone, even into a held name', async () => {
    const holder = await makeTemplate('lifecycle-held')
    const heldName = String(
      (await db.execute(sql`SELECT name FROM templates WHERE id = ${holder}`)).rows[0].name,
    )
    const trashed = await makeTemplate('lifecycle-rename-trashed')
    await trash(trashed)

    const gone = { success: false, error: 'Nie znaleziono szablonu' }
    expect(await renamePresetAction(trashed, heldName)).toEqual(gone)
    expect(await renamePresetAction(2_000_000_000, heldName)).toEqual(gone)
  })

  it('„Nadpisz” refuses a szablon in the trash and leaves its layout as it was', async () => {
    const trashed = await makeTemplate('lifecycle-overwrite-trashed')
    await addTestTemplateSection(payload, trashed, 'W koszu', [])
    await trash(trashed)

    expect(await savePresetAction(sourceId, { mode: 'overwrite', targetId: trashed })).toEqual({
      success: false,
      error: 'Nie znaleziono szablonu',
    })
    expect(await layoutOf(trashed)).toEqual([{ name: 'W koszu', prace: [] }])
  })

  it('„Nadpisz” replaces the target’s layout and leaves it a version „Przed nadpisaniem”', async () => {
    const targetId = await makeTemplate('lifecycle-overwrite')
    await addTestTemplateSection(payload, targetId, 'Stara treść', [])

    expect(await savePresetAction(sourceId, { mode: 'overwrite', targetId })).toEqual({
      success: true,
    })

    expect(await layoutOf(targetId)).toEqual(SOURCE_LAYOUT())
    expect(await versionLabels(targetId)).toEqual([`Przed nadpisaniem: ${sourceName}`])
  })

  it('„Nadpisz” refuses a missing szablon', async () => {
    expect(
      await savePresetAction(sourceId, { mode: 'overwrite', targetId: 2_000_000_000 }),
    ).toEqual({ success: false, error: 'Nie znaleziono szablonu' })
  })
})
