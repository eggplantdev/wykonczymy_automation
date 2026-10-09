import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  getPresetName,
  isTemplateInvestment,
  listPresetSections,
  listTemplateNamesByCatalogueItem,
  markPresetEdited,
  listPresets,
  presetNameHolder,
  renamePreset,
  templateOwnersOfSections,
} from '@/lib/db/presets'
import {
  createTestInvestment,
  deleteTestInvestment,
  trashDaysAgo,
} from '@/__tests__/helpers/investment'
import { createTestTemplate } from '@/__tests__/helpers/template'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

// listPresetSections counts items per section in SQL (EX-622), so its tallies and ordering are only
// real against Postgres — assert the returned metas, never the plan.
describe.skipIf(!ENV_READY)('listPresetSections (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const created: number[] = []
  let idA: number
  let idB: number
  let sectionsA: number[]
  let sectionB: number
  let nameB: string

  const items = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ description: `pozycja-${i}`, unit: 'm2' }))

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    // A: three sections, the middle one empty, and TWO sharing displayOrder 1 so the id tiebreaker is
    // exercised rather than assumed. B is created second, so it lists first.
    idA = await createTestTemplate(payload, 'ex622-fixture-a')
    idB = await createTestTemplate(payload, 'ex622-fixture-b')
    created.push(idA, idB)
    sectionsA = (
      await createKosztorysTree(payload, idA, {
        sections: [
          { name: 'sekcja-10', displayOrder: 1, items: items(2) },
          { name: 'sekcja-11', displayOrder: 1 },
          { name: 'sekcja-12', displayOrder: 0, items: items(1) },
        ],
      })
    ).sectionIds
    sectionB = (
      await createKosztorysTree(payload, idB, {
        sections: [{ name: 'sekcja-b', displayOrder: 0, items: items(3) }],
      })
    ).sectionIds[0]
    nameB = (await listPresets(db)).find((preset) => preset.id === idB)!.name
  })

  afterAll(async () => {
    for (const id of created) await deleteTestInvestment(payload, id)
  })

  it('counts items per live section', async () => {
    const metas = await listPresetSections(db)

    const countsA = metas
      .filter((meta) => meta.presetId === idA)
      .map((meta) => [meta.sectionId, meta.itemCount])
    expect(countsA).toEqual([
      [sectionsA[2], 1],
      [sectionsA[0], 2],
      [sectionsA[1], 0],
    ])
    expect(metas.filter((meta) => meta.presetId === idB).map((meta) => meta.itemCount)).toEqual([3])
  })

  it('carries the szablon and section names onto every meta', async () => {
    const metas = await listPresetSections(db)

    expect(metas.find((meta) => meta.sectionId === sectionB)).toMatchObject({
      presetId: idB,
      presetName: nameB,
      sectionName: 'sekcja-b',
    })
  })

  // The precondition the picker's grouping rests on (preset-picker-groups): interleaved metas would
  // split one szablon into two groups.
  it("returns one szablon's sections consecutively, newest szablon first", async () => {
    const metas = await listPresetSections(db)

    const ours = metas.filter((meta) => meta.presetId === idA || meta.presetId === idB)
    expect(ours.map((meta) => meta.presetId)).toEqual([idB, idA, idA, idA])
  })

  it('lists no section of an ordinary investment', async () => {
    const ordinary = await createTestInvestment(payload, 'ex622-fixture-ordinary')
    created.push(ordinary)
    await createKosztorysTree(payload, ordinary, { sections: [{ name: 'klienta' }] })

    expect((await listPresetSections(db)).some((meta) => meta.presetId === ordinary)).toBe(false)
  })
})

describe.skipIf(!ENV_READY)('templateOwnersOfSections (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const created: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
  })

  afterAll(async () => {
    for (const id of created) await deleteTestInvestment(payload, id)
  })

  it("maps a szablon's section to it and leaves an ordinary investment's out", async () => {
    const template = await createTestTemplate(payload, 'owners-fixture')
    const ordinary = await createTestInvestment(payload, 'owners-fixture-ordinary')
    created.push(template, ordinary)
    const [inTemplate] = (
      await createKosztorysTree(payload, template, { sections: [{ name: 'a' }] })
    ).sectionIds
    const [inOrdinary] = (
      await createKosztorysTree(payload, ordinary, { sections: [{ name: 'b' }] })
    ).sectionIds

    const owners = await templateOwnersOfSections(db, [inTemplate, inOrdinary])
    expect([...owners]).toEqual([[inTemplate, template]])
  })
})

// Asserted on the persisted rows (via listPresets), never on a return value — a success result can
// hide a failed write.
describe.skipIf(!ENV_READY)('renamePreset / listPresets (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const created: number[] = []

  async function makeTemplate(name: string): Promise<number> {
    const id = await createTestTemplate(payload, name)
    created.push(id)
    return id
  }

  const nameOf = async (id: number) =>
    (await listPresets(db)).find((preset) => preset.id === id)?.name

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
  })

  afterAll(async () => {
    for (const id of created) await deleteTestInvestment(payload, id)
  })

  it('renames in place, keeping the id', async () => {
    const id = await makeTemplate('crud-fixture-old-name')
    const next = `crud-fixture-new-name ${id}`

    expect(await renamePreset(db, id, next)).toBe(true)
    expect(await nameOf(id)).toBe(next)
  })

  // `updated_at` is the editor's remount token — a rename moving it would reset the owner's sort and
  // filters in an open editor.
  it('leaves updated_at alone', async () => {
    const id = await makeTemplate('crud-fixture-remount')
    const before = await db.execute(sql`SELECT updated_at FROM investments WHERE id = ${id}`)

    await renamePreset(db, id, `crud-fixture-remount-renamed ${id}`)

    const after = await db.execute(sql`SELECT updated_at FROM investments WHERE id = ${id}`)
    expect(after.rows[0].updated_at).toEqual(before.rows[0].updated_at)
  })

  it('renames no ordinary investment', async () => {
    const ordinary = await createTestInvestment(payload, 'crud-fixture-ordinary')
    created.push(ordinary)

    expect(await renamePreset(db, ordinary, `crud-fixture-hijacked ${ordinary}`)).toBe(false)
  })

  // The collision guard lives in SQL and matches the unique index — case and edge spaces don't make
  // a name new.
  it.each([
    ['same case', (name: string) => name],
    ['other case', (name: string) => name.toUpperCase()],
    ['edge spaces', (name: string) => `  ${name}  `],
  ])('refuses a taken name (%s) without touching either szablon', async (_, variant) => {
    const mine = await makeTemplate('crud-fixture-mine')
    const theirs = await makeTemplate('crud-fixture-theirs')
    const mineName = await nameOf(mine)
    const theirsName = (await nameOf(theirs))!

    expect(await presetNameHolder(db, variant(theirsName))).toBe('live')
    expect(await renamePreset(db, mine, variant(theirsName))).toBe(false)
    expect(await nameOf(mine)).toBe(mineName)
    expect(await nameOf(theirs)).toBe(theirsName)
  })

  it('treats its own name as free when renaming itself', async () => {
    const id = await makeTemplate('crud-fixture-self')

    expect(await presetNameHolder(db, (await nameOf(id))!, id)).toBeUndefined()
  })

  // The listing sorts by the last edit, because that is the figure that moves — a szablon is created
  // once and worked on for weeks. The trap is a szablon migrated without a stamp: a plain DESC would
  // drop it out of the view.
  it('sorts by the last edit and keeps an unstamped szablon in the list', async () => {
    const stale = await makeTemplate('crud-fixture-order-stale')
    const fresh = await makeTemplate('crud-fixture-order-fresh')
    const legacy = await makeTemplate('crud-fixture-order-legacy')

    await db.execute(
      sql`UPDATE investments SET content_edited_at = now() - interval '2 days' WHERE id = ${stale}`,
    )
    await db.execute(sql`UPDATE investments SET content_edited_at = now() WHERE id = ${fresh}`)
    await db.execute(sql`UPDATE investments SET content_edited_at = NULL WHERE id = ${legacy}`)

    const ours = (await listPresets(db)).filter((preset) =>
      [stale, fresh, legacy].includes(preset.id),
    )

    expect(ours.map((preset) => preset.id)).toEqual([fresh, stale, legacy])
    expect(ours.find((preset) => preset.id === legacy)?.updatedAt).toBeNull()
  })

  // A renamed szablon is the one the owner just touched, so the rename moves it to the top.
  it('moves a renamed szablon to the top', async () => {
    const id = await makeTemplate('crud-fixture-stamp')
    await db.execute(
      sql`UPDATE investments SET content_edited_at = now() - interval '2 days' WHERE id = ${id}`,
    )

    expect(await renamePreset(db, id, `crud-fixture-stamp-renamed ${id}`)).toBe(true)
    expect((await listPresets(db))[0]?.id).toBe(id)
  })

  // Every write into a szablon stamps it (investmentAction); `updated_at` staying put is what keeps an
  // open editor from remounting under the user's hands.
  it('stamps an edit without moving updated_at', async () => {
    const id = await makeTemplate('crud-fixture-edited')
    await db.execute(
      sql`UPDATE investments SET content_edited_at = now() - interval '2 days' WHERE id = ${id}`,
    )
    const before = await db.execute(sql`SELECT updated_at FROM investments WHERE id = ${id}`)

    await markPresetEdited(db, id)

    const after = await db.execute(sql`SELECT updated_at FROM investments WHERE id = ${id}`)
    expect(after.rows[0].updated_at).toEqual(before.rows[0].updated_at)
    expect((await listPresets(db))[0]?.id).toBe(id)
  })

  it('lists no ordinary investment', async () => {
    const ordinary = await createTestInvestment(payload, 'crud-fixture-not-listed')
    created.push(ordinary)

    expect((await listPresets(db)).some((preset) => preset.id === ordinary)).toBe(false)
  })
})

// A trashed szablon is invisible to every reader until it is restored — a picker that still offered
// it would seed a kosztorys from something the user threw away. The name checks are the exception:
// the unique index still counts it.
describe.skipIf(!ENV_READY)('a trashed szablon (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const created: number[] = []
  let trashed: number
  let trashedName: string
  let trashedSection: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    trashed = await createTestTemplate(payload, 'trash-fixture')
    created.push(trashed)
    trashedSection = (
      await createKosztorysTree(payload, trashed, {
        sections: [{ name: 'sekcja', items: [{ description: 'pozycja', unit: 'm2' }] }],
      })
    ).sectionIds[0]
    trashedName = (await getPresetName(db, trashed))!
    await trashDaysAgo(db, trashed, 0)
  })

  afterAll(async () => {
    for (const id of created) await deleteTestInvestment(payload, id)
  })

  it('is absent from the list and the section picker', async () => {
    expect((await listPresets(db)).some((preset) => preset.id === trashed)).toBe(false)
    expect((await listPresetSections(db)).some((meta) => meta.presetId === trashed)).toBe(false)
  })

  it('is not a szablon to any reader that names it', async () => {
    expect(await isTemplateInvestment(db, trashed)).toBe(false)
    expect(await getPresetName(db, trashed)).toBeNull()
    expect((await templateOwnersOfSections(db, [trashedSection])).size).toBe(0)
  })

  it('cannot be renamed', async () => {
    expect(await renamePreset(db, trashed, `trash-fixture-renamed ${trashed}`)).toBe(false)
    const row = await db.execute(sql`SELECT name FROM investments WHERE id = ${trashed}`)
    expect(row.rows[0].name).toBe(trashedName)
  })

  it('still holds its name, as trashed', async () => {
    expect(await presetNameHolder(db, trashedName.toUpperCase())).toBe('trashed')
  })

  it('keeps a live szablon from taking its name by rename', async () => {
    const live = await createTestTemplate(payload, 'trash-fixture-live')
    created.push(live)

    expect(await renamePreset(db, live, trashedName)).toBe(false)
    expect(await presetNameHolder(db, trashedName, live)).toBe('trashed')
  })
})

// „Szablony" on /katalog-prac is the length of this list, so a praca repeated in two sekcje of one
// szablon names it once, and a trashed szablon or an ordinary kosztorys names nothing.
describe.skipIf(!ENV_READY)('listTemplateNamesByCatalogueItem (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const created: number[] = []
  let entryId: number
  let live: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const description = `Szpachlowanie ${crypto.randomUUID().slice(0, 8)}`
    const entry = await payload.create({
      collection: 'work-catalogue-items',
      data: { description, unit: 'm2', clientPrice: 30, matchKey: catalogueKey(description, 'm2') },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    entryId = Number(entry.id)

    const row = { description, unit: 'm2', clientPrice: 30, catalogueItemId: entryId }
    const once = { sections: [{ name: 'Salon', items: [row] }] }
    live = await createTestTemplate(payload, 'catalogue-names-live')
    const trashed = await createTestTemplate(payload, 'catalogue-names-trashed')
    const kosztorys = await createTestInvestment(payload, `catalogue-names-kosztorys ${entryId}`)
    created.push(live, trashed, kosztorys)

    await createKosztorysTree(payload, live, {
      sections: [
        { name: 'Salon', items: [row] },
        { name: 'Kuchnia', items: [row] },
      ],
    })
    await createKosztorysTree(payload, trashed, once)
    await createKosztorysTree(payload, kosztorys, once)
    await trashDaysAgo(db, trashed, 0)
  })

  afterAll(async () => {
    for (const id of created) await deleteTestInvestment(payload, id)
    await db.execute(sql`DELETE FROM work_catalogue_items WHERE id = ${entryId}`)
  })

  it('names each live szablon once, however many sekcje repeat the praca', async () => {
    const names = await listTemplateNamesByCatalogueItem(db)
    expect(names[entryId]).toEqual([await getPresetName(db, live)])
  })
})
